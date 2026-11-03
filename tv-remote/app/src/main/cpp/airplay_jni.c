/*
 * שלט מהפון - מקלט AirPlay (שיקוף מסך מאייפון) על בסיס UxPlay.
 * הקוד כאן רק מחבר בין ספריית UxPlay (C) לבין האפליקציה (Kotlin):
 *  - מפעיל את שרת ה-AirPlay ואת פרסום השם ברשת (mDNS)
 *  - מעביר את הווידאו (H.264) והקול (AAC) המפוענחים מההצפנה ל-Kotlin, שם MediaCodec מציג אותם.
 */
#include <jni.h>
#include <pthread.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <android/log.h>

#include "raop.h"
#include "dnssd.h"
#include "stream.h"
#include "logger.h"

#define TAG "AirPlay"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

static JavaVM *g_vm = NULL;
static jclass g_cls = NULL;
static jmethodID m_onVideo, m_onVideoSize, m_onAudio, m_onAudioFormat, m_onConnection, m_onVideoReset, m_onLog, m_onVolume;
static pthread_key_t g_env_key;

static pthread_mutex_t g_lock = PTHREAD_MUTEX_INITIALIZER;
/* מנעול נפרד למונה: raop_destroy קורא ל-conn_destroy כשהמנעול הראשי תפוס */
static pthread_mutex_t g_count_lock = PTHREAD_MUTEX_INITIALIZER;
static raop_t *g_raop = NULL;
static dnssd_t *g_dnssd = NULL;
static int g_connections = 0;

static void detach_thread(void *unused) {
    (void) unused;
    if (g_vm) (*g_vm)->DetachCurrentThread(g_vm);
}

static JNIEnv *get_env(void) {
    JNIEnv *env = NULL;
    if (!g_vm) return NULL;
    jint r = (*g_vm)->GetEnv(g_vm, (void **) &env, JNI_VERSION_1_6);
    if (r == JNI_OK) return env;
    if (r == JNI_EDETACHED) {
        if ((*g_vm)->AttachCurrentThread(g_vm, &env, NULL) != JNI_OK) return NULL;
        /* הת'רדים של UxPlay נוצרים ב-C: מנתקים אותם מ-Java אוטומטית כשהם מסתיימים */
        pthread_setspecific(g_env_key, (void *) 1);
        return env;
    }
    return NULL;
}

static void clear_exc(JNIEnv *env) {
    if ((*env)->ExceptionCheck(env)) {
        (*env)->ExceptionDescribe(env);
        (*env)->ExceptionClear(env);
    }
}

JNIEXPORT jint JNI_OnLoad(JavaVM *vm, void *reserved) {
    (void) reserved;
    JNIEnv *env;
    g_vm = vm;
    if ((*vm)->GetEnv(vm, (void **) &env, JNI_VERSION_1_6) != JNI_OK) return JNI_ERR;
    jclass local = (*env)->FindClass(env, "com/myphone/tvremote/AirPlayServer");
    if (!local) return JNI_ERR;
    g_cls = (jclass) (*env)->NewGlobalRef(env, local);
    (*env)->DeleteLocalRef(env, local);
    m_onVideo = (*env)->GetStaticMethodID(env, g_cls, "onVideo", "([BJ)V");
    m_onVideoSize = (*env)->GetStaticMethodID(env, g_cls, "onVideoSize", "(IIZ)V");
    m_onAudio = (*env)->GetStaticMethodID(env, g_cls, "onAudio", "([BI)V");
    m_onAudioFormat = (*env)->GetStaticMethodID(env, g_cls, "onAudioFormat", "(II)V");
    m_onConnection = (*env)->GetStaticMethodID(env, g_cls, "onConnection", "(I)V");
    m_onVideoReset = (*env)->GetStaticMethodID(env, g_cls, "onVideoReset", "()V");
    m_onLog = (*env)->GetStaticMethodID(env, g_cls, "onLog", "(Ljava/lang/String;)V");
    m_onVolume = (*env)->GetStaticMethodID(env, g_cls, "onVolume", "(F)V");
    if (!m_onVideo || !m_onVideoSize || !m_onAudio || !m_onAudioFormat || !m_onConnection || !m_onVideoReset || !m_onLog || !m_onVolume) {
        clear_exc(env);
        return JNI_ERR;
    }
    pthread_key_create(&g_env_key, detach_thread);
    return JNI_VERSION_1_6;
}

static void call_bytes(jmethodID m, const unsigned char *data, int len, jlong extra, int is_int) {
    if (!data || len <= 0) return;
    JNIEnv *env = get_env();
    if (!env) return;
    jbyteArray arr = (*env)->NewByteArray(env, len);
    if (!arr) { clear_exc(env); return; }
    (*env)->SetByteArrayRegion(env, arr, 0, len, (const jbyte *) data);
    if (is_int) (*env)->CallStaticVoidMethod(env, g_cls, m, arr, (jint) extra);
    else (*env)->CallStaticVoidMethod(env, g_cls, m, arr, extra);
    clear_exc(env);
    (*env)->DeleteLocalRef(env, arr);
}

static void call_int(jmethodID m, int v) {
    JNIEnv *env = get_env();
    if (!env) return;
    (*env)->CallStaticVoidMethod(env, g_cls, m, (jint) v);
    clear_exc(env);
}

/* ===== callbacks של UxPlay ===== */

static void cb_video_process(void *cls, raop_ntp_t *ntp, video_decode_struct *data) {
    (void) cls; (void) ntp;
    if (data->is_h265) return; /* מפרסמים רק H.264, אז זה לא אמור לקרות */
    call_bytes(m_onVideo, data->data, data->data_len, (jlong) (data->ntp_time_remote / 1000), 0);
}

static void cb_audio_process(void *cls, raop_ntp_t *ntp, audio_decode_struct *data) {
    (void) cls; (void) ntp;
    call_bytes(m_onAudio, data->data, data->data_len, (jlong) data->ct, 1);
}

static void cb_audio_get_format(void *cls, unsigned char *ct, unsigned short *spf, bool *usingScreen, bool *isMedia, uint64_t *audioFormat) {
    (void) cls; (void) usingScreen; (void) isMedia; (void) audioFormat;
    JNIEnv *env = get_env();
    if (!env) return;
    (*env)->CallStaticVoidMethod(env, g_cls, m_onAudioFormat, (jint) *ct, (jint) *spf);
    clear_exc(env);
}

static int cb_video_set_codec_and_size(void *cls, video_codec_t codec, unsigned short width_source,
                                       unsigned short height_source, unsigned short x_offset,
                                       unsigned short y_offset, unsigned short width, unsigned short height) {
    (void) cls; (void) x_offset; (void) y_offset; (void) width; (void) height;
    JNIEnv *env = get_env();
    if (!env) return 0;
    (*env)->CallStaticVoidMethod(env, g_cls, m_onVideoSize, (jint) width_source, (jint) height_source,
                                 (jboolean) (codec == VIDEO_CODEC_H265));
    clear_exc(env);
    return 0;
}

static void cb_conn_init(void *cls) {
    (void) cls;
    pthread_mutex_lock(&g_count_lock);
    int n = ++g_connections;
    pthread_mutex_unlock(&g_count_lock);
    call_int(m_onConnection, n);
}

static void cb_conn_destroy(void *cls) {
    (void) cls;
    pthread_mutex_lock(&g_count_lock);
    if (g_connections > 0) g_connections--;
    int n = g_connections;
    pthread_mutex_unlock(&g_count_lock);
    call_int(m_onConnection, n);
}

static void cb_conn_reset(void *cls, int reason) {
    (void) cls;
    LOGI("conn_reset %d", reason);
    pthread_mutex_lock(&g_count_lock);
    g_connections = 0;
    pthread_mutex_unlock(&g_count_lock);
    call_int(m_onConnection, 0);
}

static void cb_video_reset(void *cls, reset_type_t type) {
    (void) cls; (void) type;
    JNIEnv *env = get_env();
    if (!env) return;
    (*env)->CallStaticVoidMethod(env, g_cls, m_onVideoReset);
    clear_exc(env);
}

static void cb_report_client_request(void *cls, char *deviceid, char *model, char *name, bool *admit) {
    (void) cls;
    LOGI("client %s %s %s", name ? name : "", model ? model : "", deviceid ? deviceid : "");
    *admit = true;
}

static const char *cb_passwd(void *cls, int *len) { (void) cls; *len = 0; return NULL; }
static bool cb_check_register(void *cls, const char *pk) { (void) cls; (void) pk; return true; }
static void cb_register_client(void *cls, const char *d, const char *p, const char *n) { (void) cls; (void) d; (void) p; (void) n; }
static void cb_display_pin(void *cls, char *pin) { (void) cls; (void) pin; }
static void cb_noop(void *cls) { (void) cls; }
static void cb_noop_bool(void *cls, bool b) { (void) cls; (void) b; }
/* עוצמת הקול מכפתורי האייפון: dB בין -30 ל-0, ו-‎-144 = השתקה */
static void cb_volume(void *cls, float v) {
    (void) cls;
    JNIEnv *env = get_env();
    if (!env) return;
    (*env)->CallStaticVoidMethod(env, g_cls, m_onVolume, (jfloat) v);
    clear_exc(env);
}
static void cb_buffer(void *cls, const void *b, int l) { (void) cls; (void) b; (void) l; }
static void cb_dacp(void *cls, const char *a, const char *b) { (void) cls; (void) a; (void) b; }
static void cb_progress(void *cls, uint32_t *a, uint32_t *b, uint32_t *c) { (void) cls; (void) a; (void) b; (void) c; }
static void cb_video_play(void *cls, const char *l, const float p) { (void) cls; (void) l; (void) p; }
static void cb_video_float(void *cls, const float p) { (void) cls; (void) p; }
static void cb_playback_info(void *cls, playback_info_t *p) { (void) cls; (void) p; }
static float cb_playlist_remove(void *cls) { (void) cls; return 0.0f; }
/* עוצמת ההתחלה שמדווחים לאייפון (dB; 0 = מלא). חובה - הבקשה הראשונה של האייפון (/info) קוראת לזה */
static double cb_client_volume(void *cls) { (void) cls; return 0.0; }
static void cb_custom_profile(void *cls, const char **profile) { (void) cls; (void) profile; }

static void cb_log(void *cls, int level, const char *msg) {
    (void) cls;
    if (!msg) return;
    if (level <= LOGGER_WARNING) LOGE("%s", msg); else LOGI("%s", msg);
    if (level <= LOGGER_INFO) {
        JNIEnv *env = get_env();
        if (!env) return;
        jstring s = (*env)->NewStringUTF(env, msg);
        if (!s) { clear_exc(env); return; }
        (*env)->CallStaticVoidMethod(env, g_cls, m_onLog, s);
        clear_exc(env);
        (*env)->DeleteLocalRef(env, s);
    }
}

static void stop_locked(void) {
    if (g_raop) {
        raop_destroy(g_raop);
        g_raop = NULL;
    }
    if (g_dnssd) {
        dnssd_unregister_raop(g_dnssd);
        dnssd_unregister_airplay(g_dnssd);
        dnssd_destroy(g_dnssd);
        g_dnssd = NULL;
    }
    pthread_mutex_lock(&g_count_lock);
    g_connections = 0;
    pthread_mutex_unlock(&g_count_lock);
}

static int parse_mac(const char *mac, char out[6]) {
    unsigned int b[6];
    if (sscanf(mac, "%x:%x:%x:%x:%x:%x", &b[0], &b[1], &b[2], &b[3], &b[4], &b[5]) != 6) return -1;
    for (int i = 0; i < 6; i++) out[i] = (char) b[i];
    return 0;
}

/* מחזיר את הפורט שהשרת מאזין עליו, או מספר שלילי אם נכשל */
JNIEXPORT jint JNICALL
Java_com_myphone_tvremote_AirPlayServer_nativeStart(JNIEnv *env, jclass clazz, jstring jname, jstring jmac,
                                                    jstring jkeyfile, jint width, jint height, jint fps) {
    (void) clazz;
    const char *name = (*env)->GetStringUTFChars(env, jname, NULL);
    const char *mac = (*env)->GetStringUTFChars(env, jmac, NULL);
    const char *keyfile = (*env)->GetStringUTFChars(env, jkeyfile, NULL);
    int result = -1;
    char hw[6];

    pthread_mutex_lock(&g_lock);
    stop_locked();
    do {
        if (parse_mac(mac, hw)) { LOGE("bad mac %s", mac); result = -2; break; }

        int err = 0;
        g_dnssd = dnssd_init(name, (int) strlen(name), hw, 6, 0, &err);
        if (err || !g_dnssd) { LOGE("dnssd_init %d", err); g_dnssd = NULL; result = -3; break; }
        /* כמו ברירת המחדל של UxPlay: שיקוף מסך + קול, בלי HLS ובלי H.265 */
        dnssd_set_airplay_features(g_dnssd, 0, 0);
        dnssd_set_airplay_features(g_dnssd, 4, 0);
        dnssd_set_airplay_features(g_dnssd, 42, 0);
        dnssd_set_airplay_features(g_dnssd, 27, 0);

        raop_callbacks_t cbs;
        memset(&cbs, 0, sizeof(cbs));
        cbs.audio_process = cb_audio_process;
        cbs.video_process = cb_video_process;
        cbs.video_pause = cb_noop;
        cbs.video_resume = cb_noop;
        cbs.conn_feedback = cb_noop;
        cbs.conn_reset = cb_conn_reset;
        cbs.video_reset = cb_video_reset;
        cbs.video_set_codec_and_size = cb_video_set_codec_and_size;
        cbs.conn_init = cb_conn_init;
        cbs.conn_destroy = cb_conn_destroy;
        cbs.audio_flush = cb_noop;
        cbs.video_flush = cb_noop;
        cbs.audio_set_volume = cb_volume;
        cbs.audio_set_client_volume = cb_client_volume;
        cbs.get_custom_profile = cb_custom_profile;
        cbs.audio_set_metadata = cb_buffer;
        cbs.audio_set_coverart = cb_buffer;
        cbs.audio_stop_coverart_rendering = cb_noop;
        cbs.audio_remote_control_id = cb_dacp;
        cbs.audio_set_progress = cb_progress;
        cbs.audio_get_format = cb_audio_get_format;
        cbs.mirror_video_running = cb_noop_bool;
        cbs.report_client_request = cb_report_client_request;
        cbs.display_pin = cb_display_pin;
        cbs.register_client = cb_register_client;
        cbs.check_register = cb_check_register;
        cbs.passwd = cb_passwd;
        cbs.export_dacp = cb_dacp;
        cbs.on_video_play = cb_video_play;
        cbs.on_video_scrub = cb_video_float;
        cbs.on_video_rate = cb_video_float;
        cbs.on_video_stop = cb_noop;
        cbs.on_video_acquire_playback_info = cb_playback_info;
        cbs.on_video_playlist_remove = cb_playlist_remove;

        g_raop = raop_init(&cbs);
        if (!g_raop) { LOGE("raop_init"); result = -4; break; }
        raop_set_log_callback(g_raop, cb_log, NULL);
        raop_set_log_level(g_raop, LOGGER_INFO);
        if (raop_init2(g_raop, 1, mac, keyfile)) {
            LOGE("raop_init2");
            free(g_raop); /* כמו ב-UxPlay: raop_init2 נכשל לפני שנוצר משהו נוסף */
            g_raop = NULL;
            result = -5;
            break;
        }
        if (width > 0) raop_set_plist(g_raop, "width", width);
        if (height > 0) raop_set_plist(g_raop, "height", height);
        if (fps > 0) {
            raop_set_plist(g_raop, "refreshRate", fps);
            raop_set_plist(g_raop, "maxFPS", fps);
        }
        unsigned short tcp[2] = {0, 0};
        unsigned short udp[3] = {0, 0, 0};
        raop_set_tcp_ports(g_raop, tcp);
        raop_set_udp_ports(g_raop, udp);
        unsigned short port = raop_get_port(g_raop);
        if (raop_start_httpd(g_raop, &port) < 0) { LOGE("httpd"); result = -6; break; }
        raop_set_port(g_raop, port);
        raop_set_dnssd(g_raop, g_dnssd);

        if (dnssd_register_raop(g_dnssd, port)) { LOGE("register raop"); result = -7; break; }
        if (dnssd_register_airplay(g_dnssd, port)) { LOGE("register airplay"); result = -8; break; }
        LOGI("AirPlay ready on port %d as %s", port, name);
        result = port;
    } while (0);
    if (result < 0) stop_locked();
    pthread_mutex_unlock(&g_lock);

    (*env)->ReleaseStringUTFChars(env, jname, name);
    (*env)->ReleaseStringUTFChars(env, jmac, mac);
    (*env)->ReleaseStringUTFChars(env, jkeyfile, keyfile);
    return result;
}

JNIEXPORT void JNICALL
Java_com_myphone_tvremote_AirPlayServer_nativeStop(JNIEnv *env, jclass clazz) {
    (void) env; (void) clazz;
    pthread_mutex_lock(&g_lock);
    stop_locked();
    pthread_mutex_unlock(&g_lock);
}

/* מנתק את האייפון שמשקף כרגע (כפתור "עצור שיקוף" בשלט) */
JNIEXPORT void JNICALL
Java_com_myphone_tvremote_AirPlayServer_nativeDisconnect(JNIEnv *env, jclass clazz) {
    (void) env; (void) clazz;
    pthread_mutex_lock(&g_lock);
    if (g_raop) raop_remove_known_connections(g_raop);
    pthread_mutex_unlock(&g_lock);
}

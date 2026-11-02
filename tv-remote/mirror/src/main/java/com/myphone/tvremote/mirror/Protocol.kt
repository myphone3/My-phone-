package com.myphone.tvremote.mirror

/**
 * הפרוטוקול בין הטלפון לטלוויזיה (זהה בשני הצדדים):
 * בהתחלה "TVM1", ואחר כך חבילות: [סוג 1 בייט][אורך 4 בייט][זמן 8 בייט][תוכן].
 */
object Protocol {
    const val MAGIC = "TVM1"
    const val PORT = 8090
    const val SERVICE_TYPE = "_tvmirror._tcp."

    const val VIDEO_CONFIG = 1   // הגדרות הווידאו (SPS/PPS)
    const val VIDEO_FRAME = 2    // פריים רגיל
    const val AUDIO_PCM = 3      // קול: 48000 סטריאו 16 ביט
    const val VIDEO_SIZE = 4     // גודל המסך: רוחב (2 בייט) וגובה (2 בייט)
    const val VIDEO_KEYFRAME = 5 // פריים מלא

    const val AUDIO_RATE = 48000
}

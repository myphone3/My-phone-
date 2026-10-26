package com.myphone.tvremote

import android.content.Context
import android.os.Build
import fi.iki.elonen.NanoHTTPD
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream

/** שרת קטן שמגיש לטלפון את דף השלט ומקבל ממנו פקודות. */
class WebServer(private val context: Context, port: Int) : NanoHTTPD(port) {

    override fun serve(session: IHTTPSession): Response {
        val params = session.parameters.mapValues { it.value.firstOrNull().orEmpty() }
        return try {
            when (session.uri) {
                "/", "/index.html" -> asset("web/index.html", "text/html; charset=utf-8")
                "/manifest.webmanifest" -> json(manifest(), "application/manifest+json; charset=utf-8")
                "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png", "/logo.png" ->
                    asset("web" + session.uri, "image/png", cache = true)
                "/api/status" -> json(
                    JSONObject()
                        .put("connected", AdbBridge.connected)
                        .put("status", AdbBridge.status)
                        .put("name", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                )
                "/api/key" -> {
                    val code = KEYS[params["k"]] ?: return error("unknown key")
                    val times = (params["n"]?.toIntOrNull() ?: 1).coerceIn(1, 10)
                    AdbBridge.sendKeys(code, times)
                    ok()
                }
                "/api/text" -> {
                    val text = params["t"].orEmpty()
                    if (text.length > 300) return error("too_long")
                    AdbBridge.typeText(text)?.let { error(it) } ?: ok()
                }
                "/api/submit" -> { AdbBridge.submitText(); ok() }
                "/api/youtube" -> {
                    val query = params["q"].orEmpty().trim()
                    if (query.isEmpty() || query.length > 300) return error("empty")
                    AdbBridge.youtubeSearch(query, Apps.youtubeApp(context))
                    ok()
                }
                "/api/apps" -> {
                    val array = JSONArray()
                    for ((pkg, label) in Apps.list(context)) array.put(JSONObject().put("pkg", pkg).put("label", label))
                    json(array)
                }
                "/api/icon" -> Apps.iconPng(context, params["pkg"].orEmpty())?.let { png(it, cache = true) }
                    ?: newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "")
                "/api/launch" -> if (Apps.launch(context, params["pkg"].orEmpty())) ok() else error("not found")
                "/api/reconnect" -> { AdbBridge.reconnect(); ok() }
                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "not found")
            }
        } catch (e: Exception) {
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, e.toString())
        }
    }

    private fun manifest() = JSONObject()
        .put("name", "שלט לטלוויזיה")
        .put("short_name", "שלט")
        .put("start_url", "/")
        .put("display", "standalone")
        .put("background_color", "#0F0E26")
        .put("theme_color", "#0F0E26")
        .put("dir", "rtl")
        .put("lang", "he")
        .put(
            "icons", JSONArray()
                .put(JSONObject().put("src", "/icon-192.png").put("sizes", "192x192").put("type", "image/png"))
                .put(JSONObject().put("src", "/icon-512.png").put("sizes", "512x512").put("type", "image/png"))
        )

    private fun asset(path: String, mime: String, cache: Boolean = false): Response {
        val bytes = context.assets.open(path).use { it.readBytes() }
        return newFixedLengthResponse(Response.Status.OK, mime, ByteArrayInputStream(bytes), bytes.size.toLong())
            .also { it.addHeader("Cache-Control", if (cache) "max-age=86400" else "no-cache") }
    }

    private fun png(bytes: ByteArray, cache: Boolean = false) =
        newFixedLengthResponse(Response.Status.OK, "image/png", ByteArrayInputStream(bytes), bytes.size.toLong())
            .also { if (cache) it.addHeader("Cache-Control", "max-age=86400") }

    private fun json(body: Any, mime: String = "application/json; charset=utf-8") =
        newFixedLengthResponse(Response.Status.OK, mime, body.toString())
            .also { it.addHeader("Cache-Control", "no-store") }

    private fun ok() = json(JSONObject().put("ok", true))

    private fun error(message: String) =
        newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json; charset=utf-8", JSONObject().put("error", message).toString())
}

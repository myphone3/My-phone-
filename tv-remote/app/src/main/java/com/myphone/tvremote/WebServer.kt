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
                "/icon.png" -> png(Apps.remoteIconPng((params["s"]?.toIntOrNull() ?: 192).coerceIn(48, 512)))
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
                    if (text.isEmpty() || text.length > 200) return error("empty")
                    if (text.any { it.code > 126 || it.code < 32 }) return error("only_english")
                    AdbBridge.typeText(text)
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
                .put(JSONObject().put("src", "/icon.png?s=192").put("sizes", "192x192").put("type", "image/png"))
                .put(JSONObject().put("src", "/icon.png?s=512").put("sizes", "512x512").put("type", "image/png"))
        )

    private fun asset(path: String, mime: String): Response {
        val bytes = context.assets.open(path).use { it.readBytes() }
        return newFixedLengthResponse(Response.Status.OK, mime, ByteArrayInputStream(bytes), bytes.size.toLong())
            .also { it.addHeader("Cache-Control", "no-cache") }
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

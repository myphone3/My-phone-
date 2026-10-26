package com.myphone.tvremote

import android.content.Context
import fi.iki.elonen.NanoHTTPD
import java.io.ByteArrayInputStream

/** שרת קטן שמגיש לטלפון את דף השלט ומקבל ממנו פקודות כשהם על אותה רשת. */
class WebServer(private val context: Context, port: Int) : NanoHTTPD(port) {

    override fun serve(session: IHTTPSession): Response {
        val params = session.parameters.mapValues { it.value.firstOrNull().orEmpty() }
        val uri = session.uri
        return try {
            when {
                uri == "/" || uri == "/index.html" -> asset("web/index.html", "text/html; charset=utf-8")
                uri == "/manifest.webmanifest" -> asset("web/manifest.webmanifest", "application/manifest+json; charset=utf-8")
                uri in STATIC_IMAGES -> asset("web$uri", "image/png", cache = true)
                uri == "/api/icon" -> Apps.iconPng(context, params["pkg"].orEmpty())?.let { png(it) }
                    ?: newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "")
                uri.startsWith("/api/") -> {
                    val result = Commands.handle(context, uri.removePrefix("/api/"), params)
                    newFixedLengthResponse(
                        if (result.ok) Response.Status.OK else Response.Status.BAD_REQUEST,
                        "application/json; charset=utf-8",
                        result.body.toString(),
                    ).also { it.addHeader("Cache-Control", "no-store") }
                }
                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "not found")
            }
        } catch (e: Exception) {
            newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, e.toString())
        }
    }

    private fun asset(path: String, mime: String, cache: Boolean = false): Response {
        val bytes = context.assets.open(path).use { it.readBytes() }
        return newFixedLengthResponse(Response.Status.OK, mime, ByteArrayInputStream(bytes), bytes.size.toLong())
            .also { it.addHeader("Cache-Control", if (cache) "max-age=86400" else "no-cache") }
    }

    private fun png(bytes: ByteArray) =
        newFixedLengthResponse(Response.Status.OK, "image/png", ByteArrayInputStream(bytes), bytes.size.toLong())
            .also { it.addHeader("Cache-Control", "max-age=86400") }

    companion object {
        private val STATIC_IMAGES = setOf("/apple-touch-icon.png", "/icon-192.png", "/icon-512.png", "/icon-maskable.png", "/logo.png")
    }
}

package com.myphone.tvremote

import android.content.Context
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject

/** כל הפקודות שהטלפון יכול לשלוח, גם דרך הרשת הביתית וגם דרך האינטרנט. */
object Commands {
    class Result(val ok: Boolean, val body: Any)

    private fun ok(body: Any = JSONObject().put("ok", true)) = Result(true, body)
    private fun fail(error: String) = Result(false, JSONObject().put("error", error))

    fun handle(context: Context, command: String, params: Map<String, String>): Result = when (command) {
        "status" -> {
            AdbBridge.ensureConnected()
            ok(
            JSONObject()
                .put("connected", AdbBridge.connected)
                .put("status", AdbBridge.status)
                .put("name", TvIdentity.name(context))
                .put("tv", TvIdentity.id(context))
                .put("remoteUrl", Config.remoteUrl(TvIdentity.id(context)))
                .put("cloud", CloudRelay.online)
            )
        }
        "key" -> {
            val code = KEYS[params["k"]]
            if (code == null) fail("unknown key") else {
                CursorOverlay.hide()
                AdbBridge.sendKeys(code, (params["n"]?.toIntOrNull() ?: 1).coerceIn(1, 10))
                ok()
            }
        }
        "text" -> {
            val text = params["t"].orEmpty()
            if (text.length > 300) fail("too_long") else AdbBridge.typeText(text)?.let { fail(it) } ?: ok()
        }
        "mouse" -> {
            val dx = params["dx"]?.toFloatOrNull() ?: 0f
            val dy = params["dy"]?.toFloatOrNull() ?: 0f
            CursorOverlay.move(dx.coerceIn(-400f, 400f), dy.coerceIn(-400f, 400f))
            ok()
        }
        "click" -> { CursorOverlay.click(); ok() }
        "longpress" -> { CursorOverlay.longPress(); ok() }
        "scroll" -> {
            CursorOverlay.scroll(
                (params["dx"]?.toFloatOrNull() ?: 0f).coerceIn(-600f, 600f),
                (params["dy"]?.toFloatOrNull() ?: 0f).coerceIn(-600f, 600f),
            )
            ok()
        }
        "submit" -> { AdbBridge.submitText(); ok() }
        "youtube" -> {
            val query = params["q"].orEmpty().trim()
            if (query.isEmpty() || query.length > 300) fail("empty") else {
                AdbBridge.youtubeSearch(query, Apps.youtubeApp(context))
                ok()
            }
        }
        "apps" -> {
            val array = JSONArray()
            for ((pkg, label) in Apps.list(context)) array.put(JSONObject().put("pkg", pkg).put("label", label))
            ok(array)
        }
        "icon" -> {
            val pkg = params["pkg"].orEmpty()
            val png = Apps.iconPng(context, pkg, 72)
            if (png == null) fail("not found")
            else ok(JSONObject().put("pkg", pkg).put("png", Base64.encodeToString(png, Base64.NO_WRAP)))
        }
        "launch" -> if (Apps.launch(context, params["pkg"].orEmpty())) ok() else fail("not found")
        "reconnect" -> { AdbBridge.reconnect(); ok() }
        "rename" -> {
            val name = params["name"].orEmpty().trim()
            if (name.isEmpty() || name.length > 30) fail("bad name") else {
                TvIdentity.setName(context, name)
                ok()
            }
        }
        else -> fail("unknown command")
    }
}

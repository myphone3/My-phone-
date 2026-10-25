package com.myphone.tvremote

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** מפעיל את השלט אוטומטית כשהטלוויזיה נדלקת. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        RemoteService.start(context)
    }
}

package com.myphone.tvremote

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** מפעיל את השלט אוטומטית כשהטלוויזיה נדלקת או כשהאפליקציה מתעדכנת. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        RemoteService.start(context)
        // בהדלקה: אם מסך הבית שלנו מופעל - פותחים אותו מיד (מותר לנו, כי יש לאפליקציה הרשאת "תצוגה מעל אפליקציות")
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED && RemoteAccessibility.homeTakeover(context)) {
            try {
                context.startActivity(Intent(context, HomeActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (e: Exception) {
            }
        }
    }
}

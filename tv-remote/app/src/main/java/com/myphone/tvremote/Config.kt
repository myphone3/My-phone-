package com.myphone.tvremote

/** הגדרות חיבור דרך האינטרנט (Supabase Realtime) והכתובת של דף השלט בענן. */
object Config {
    const val SUPABASE_HOST = "iiaxizrezhczgutqijbe.supabase.co"

    // מפתח ציבורי (anon) - מיועד לשימוש בצד הלקוח
    const val SUPABASE_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpYXhpenJlemhjemd1dHFpamJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MjgyMTMsImV4cCI6MjEwMzIwNDIxM30.vG58ldzdzTSU_bAU1pO8LHwB_jm-eOoy4EMbZWQrH18"

    const val REMOTE_PAGE = "https://myphone3.github.io/My-phone-/"

    fun remoteUrl(tvId: String) = "${REMOTE_PAGE}?tv=$tvId"
}

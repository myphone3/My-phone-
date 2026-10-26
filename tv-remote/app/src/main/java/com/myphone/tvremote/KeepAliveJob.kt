package com.myphone.tvremote

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.util.Log

/** בדיקה כל 15 דקות: אם הטלוויזיה סגרה את השלט, מפעילים אותו מחדש. */
class KeepAliveJob : JobService() {
    override fun onStartJob(params: JobParameters?): Boolean {
        try {
            RemoteService.start(this)
        } catch (e: Exception) {
            Log.w("KeepAliveJob", "restart failed", e)
        }
        return false
    }

    override fun onStopJob(params: JobParameters?) = true

    companion object {
        fun schedule(context: Context) {
            val scheduler = context.getSystemService(JobScheduler::class.java)
            if (scheduler.getPendingJob(1) != null) return
            val job = JobInfo.Builder(1, ComponentName(context, KeepAliveJob::class.java))
                .setPeriodic(15 * 60 * 1000L)
                .setPersisted(true)
                .build()
            scheduler.schedule(job)
        }
    }
}

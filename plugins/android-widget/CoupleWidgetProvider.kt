package __PACKAGE__

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.util.Calendar
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

/**
 * Ana ekran widget'ı. Veri sözleşmesi: src/utils/widgetBridge.ts → CoupleWidgetPayload.
 *
 * - Gün sayısı burada, `startDate`'ten hesaplanır: uygulama açılmasa da doğru kalır.
 * - Gece yarısı, saat/tarih/saat dilimi değişimi ve Premium bitişinde widget kendini yeniler.
 * - Premium değilse / giriş yoksa kilit ve giriş mesajı gösterir.
 */
class CoupleWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (id in appWidgetIds) renderSafely(context, appWidgetManager, id)
        scheduleNextRefresh(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle
    ) {
        renderSafely(context, appWidgetManager, appWidgetId)
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
    }

    override fun onEnabled(context: Context) {
        scheduleNextRefresh(context)
    }

    override fun onDisabled(context: Context) {
        cancelScheduledRefresh(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_REFRESH,
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> refreshAll(context)
        }
    }

    companion object {
        const val PREFS_NAME = "CoupleWidgetPrefs"
        const val DATA_KEY = "widget_data"
        const val ACTION_REFRESH = "__PACKAGE__.WIDGET_REFRESH"
        private const val REFRESH_REQUEST_CODE = 7701
        private const val SMALL_LAYOUT_MAX_DP = 199

        /** Tüm widget örneklerini güncel veriyle yeniden çizer. */
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, CoupleWidgetProvider::class.java))
            if (ids.isEmpty()) return
            for (id in ids) renderSafely(context, manager, id)
            scheduleNextRefresh(context)
        }

        private fun renderSafely(context: Context, manager: AppWidgetManager, id: Int) {
            try {
                render(context, manager, id)
            } catch (t: Throwable) {
                // Çizim hatası widget'ı boş bırakmasın: en azından giriş/uygulama mesajı göster
                try {
                    manager.updateAppWidget(id, fallbackViews(context))
                } catch (ignored: Throwable) {
                }
            }
        }

        private class WidgetData(
            val state: String,
            val myName: String,
            val partnerName: String,
            val startDate: String?,
            val premiumUntilMs: Long?,
            val moodEmoji: String?,
            val moodLabel: String?,
            val moodDate: String?,
            val myAvatar: String?,
            val partnerAvatar: String?
        )

        private fun str(obj: JSONObject, key: String): String? {
            if (obj.isNull(key)) return null
            val value = obj.optString(key, "")
            return if (value.isEmpty()) null else value
        }

        private fun readData(context: Context): WidgetData {
            val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(DATA_KEY, null)
            if (raw.isNullOrEmpty()) {
                return WidgetData("signedOut", "", "", null, null, null, null, null, null, null)
            }
            return try {
                val obj = JSONObject(raw)
                WidgetData(
                    state = str(obj, "state") ?: "signedOut",
                    myName = str(obj, "myName") ?: "",
                    partnerName = str(obj, "partnerName") ?: "Sevgilin",
                    startDate = str(obj, "startDate"),
                    premiumUntilMs = if (obj.isNull("premiumUntilMs")) null else obj.optLong("premiumUntilMs"),
                    moodEmoji = str(obj, "partnerMoodEmoji"),
                    moodLabel = str(obj, "partnerMoodLabel"),
                    moodDate = str(obj, "moodDate"),
                    myAvatar = str(obj, "myAvatarPath"),
                    partnerAvatar = str(obj, "partnerAvatarPath")
                )
            } catch (ignored: Throwable) {
                WidgetData("signedOut", "", "", null, null, null, null, null, null, null)
            }
        }

        private fun startOfToday(): Calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        private fun todayKey(): String {
            val c = Calendar.getInstance()
            return String.format(
                "%04d-%02d-%02d",
                c.get(Calendar.YEAR),
                c.get(Calendar.MONTH) + 1,
                c.get(Calendar.DAY_OF_MONTH)
            )
        }

        /** Uygulamadaki sayaçla aynı: bugünün başlangıcı - başlangıç günü, negatif olamaz. */
        private fun daysSince(startDate: String?): Long? {
            if (startDate == null) return null
            val parts = startDate.split("-")
            if (parts.size != 3) return null
            return try {
                val start = Calendar.getInstance().apply {
                    clear()
                    set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt(), 0, 0, 0)
                }
                val diff = ((startOfToday().timeInMillis - start.timeInMillis) / 86_400_000.0).roundToLong()
                max(0L, diff)
            } catch (ignored: Throwable) {
                null
            }
        }

        private fun isLocked(data: WidgetData): Boolean {
            if (data.state == "locked") return true
            val until = data.premiumUntilMs
            return data.state == "ready" && until != null && until <= System.currentTimeMillis()
        }

        private fun circleBitmap(path: String?, sizePx: Int): Bitmap? {
            if (path.isNullOrEmpty()) return null
            return try {
                val cleanPath = if (path.startsWith("file://")) Uri.parse(path).path else path
                val file = File(cleanPath ?: return null)
                if (!file.exists()) return null

                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(file.path, bounds)
                var sample = 1
                while (bounds.outWidth / (sample * 2) >= sizePx && bounds.outHeight / (sample * 2) >= sizePx) {
                    sample *= 2
                }
                val source = BitmapFactory.decodeFile(
                    file.path,
                    BitmapFactory.Options().apply { inSampleSize = sample }
                ) ?: return null

                val side = min(source.width, source.height)
                val output = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(output)
                val paint = Paint(Paint.ANTI_ALIAS_FLAG)
                canvas.drawCircle(sizePx / 2f, sizePx / 2f, sizePx / 2f, paint)
                paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
                val srcRect = Rect(
                    (source.width - side) / 2,
                    (source.height - side) / 2,
                    (source.width + side) / 2,
                    (source.height + side) / 2
                )
                canvas.drawBitmap(source, srcRect, Rect(0, 0, sizePx, sizePx), paint)
                source.recycle()
                output
            } catch (ignored: Throwable) {
                null
            }
        }

        private fun bindAvatar(
            views: RemoteViews,
            imageId: Int,
            initialId: Int,
            path: String?,
            name: String,
            sizePx: Int
        ) {
            val bitmap = circleBitmap(path, sizePx)
            views.setTextViewText(initialId, name.trim().take(1).uppercase().ifEmpty { "♥" })
            if (bitmap != null) {
                views.setImageViewBitmap(imageId, bitmap)
                views.setViewVisibility(imageId, View.VISIBLE)
            } else {
                views.setViewVisibility(imageId, View.GONE)
            }
        }

        private fun clickIntent(context: Context, url: String, requestCode: Int): PendingIntent {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                setPackage(context.packageName)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        private fun fallbackViews(context: Context): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.couple_widget)
            views.setViewVisibility(R.id.content_group, View.GONE)
            views.setViewVisibility(R.id.message_group, View.VISIBLE)
            views.setTextViewText(R.id.message_emoji, "❤️")
            views.setTextViewText(R.id.message_title, "Couples App")
            views.setTextViewText(R.id.message_sub, "Açmak için dokun")
            views.setOnClickPendingIntent(R.id.widget_root, clickIntent(context, "couplesapp:///home", 0))
            return views
        }

        private fun render(context: Context, manager: AppWidgetManager, id: Int) {
            val data = readData(context)
            val options = manager.getAppWidgetOptions(id)
            val minWidthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
            val small = minWidthDp in 1..SMALL_LAYOUT_MAX_DP

            val views = RemoteViews(
                context.packageName,
                if (small) R.layout.couple_widget_small else R.layout.couple_widget
            )

            val locked = isLocked(data)
            val ready = data.state == "ready" && !locked

            if (!ready) {
                views.setViewVisibility(R.id.content_group, View.GONE)
                views.setViewVisibility(R.id.message_group, View.VISIBLE)
                if (data.state == "signedOut") {
                    views.setTextViewText(R.id.message_emoji, "❤️")
                    views.setTextViewText(R.id.message_title, "Couples App")
                    views.setTextViewText(R.id.message_sub, "Widget için giriş yap")
                    views.setOnClickPendingIntent(R.id.widget_root, clickIntent(context, "couplesapp:///home", 0))
                } else {
                    views.setTextViewText(R.id.message_emoji, "👑")
                    views.setTextViewText(R.id.message_title, "Premium üyelere özel")
                    views.setTextViewText(R.id.message_sub, "Widget için Premium’a geç")
                    views.setOnClickPendingIntent(R.id.widget_root, clickIntent(context, "couplesapp:///paywall", 1))
                }
                manager.updateAppWidget(id, views)
                return
            }

            views.setViewVisibility(R.id.content_group, View.VISIBLE)
            views.setViewVisibility(R.id.message_group, View.GONE)

            val density = context.resources.displayMetrics.density
            val avatarSizePx = ((if (small) 40 else 56) * density).toInt()
            bindAvatar(views, R.id.avatar_me_img, R.id.avatar_me_initial, data.myAvatar, data.myName, avatarSizePx)
            bindAvatar(
                views, R.id.avatar_partner_img, R.id.avatar_partner_initial,
                data.partnerAvatar, data.partnerName, avatarSizePx
            )

            val days = daysSince(data.startDate)
            views.setTextViewText(R.id.widget_days, days?.toString() ?: "—")
            views.setTextViewText(
                R.id.widget_days_label,
                if (days == null) "Tarih ekle" else "gündür birlikte ❤️"
            )

            // Ruh hali yalnızca ait olduğu gün gösterilir (dünkü ruh hali bugün yanlış olur)
            val moodVisible = !data.moodEmoji.isNullOrEmpty() && data.moodDate == todayKey()
            if (moodVisible) {
                views.setTextViewText(R.id.mood_badge, data.moodEmoji)
                views.setViewVisibility(R.id.mood_badge, View.VISIBLE)
            } else {
                views.setViewVisibility(R.id.mood_badge, View.GONE)
            }
            if (!small) {
                if (moodVisible) {
                    views.setTextViewText(R.id.widget_mood_line, "${data.partnerName}: ${data.moodLabel ?: ""}")
                    views.setViewVisibility(R.id.widget_mood_line, View.VISIBLE)
                } else {
                    views.setViewVisibility(R.id.widget_mood_line, View.GONE)
                }
            }

            views.setOnClickPendingIntent(R.id.widget_root, clickIntent(context, "couplesapp:///home", 0))
            manager.updateAppWidget(id, views)
        }

        // ─── Zamanlı yenileme (gece yarısı + Premium bitişi) ───────────────────────

        private fun refreshPendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, CoupleWidgetProvider::class.java).apply { action = ACTION_REFRESH }
            return PendingIntent.getBroadcast(
                context,
                REFRESH_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        private fun scheduleNextRefresh(context: Context) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                val midnight = startOfToday().apply {
                    add(Calendar.DAY_OF_YEAR, 1)
                    set(Calendar.SECOND, 5)
                }.timeInMillis

                var triggerAt = midnight
                val until = readData(context).premiumUntilMs
                if (until != null && until > System.currentTimeMillis()) {
                    triggerAt = min(triggerAt, until + 1_000)
                }
                // Hassas olmayan alarm: özel izin gerektirmez, cihaz uyanıkken tetiklenir
                alarmManager.set(AlarmManager.RTC, triggerAt, refreshPendingIntent(context))
            } catch (ignored: Throwable) {
                // Alarm kurulamazsa updatePeriodMillis ve tarih değişim yayınları devrede kalır
            }
        }

        private fun cancelScheduledRefresh(context: Context) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                alarmManager.cancel(refreshPendingIntent(context))
            } catch (ignored: Throwable) {
            }
        }
    }
}

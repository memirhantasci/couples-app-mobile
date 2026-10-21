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
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.util.Calendar
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

/**
 * Ana ekran ve kilit ekranı widget'ı. Veri sözleşmesi: src/utils/widgetBridge.ts → CoupleWidgetPayload.
 * Tasarım ve metinler iOS widget'ıyla (widgets/CoupleWidget.tsx) aynıdır.
 *
 * - Gün sayısı ve sıradaki dönüm noktası burada, `startDate`'ten hesaplanır: uygulama açılmasa da doğru kalır.
 * - Üç yerleşim: küçük (2x2), orta (4x2), büyük (4x3+; kilit ekranı widget alanı da bu boydadır).
 * - Gece yarısı, saat/tarih/saat dilimi değişimi ve Premium bitişinde widget kendini yeniler.
 * - Premium değilse / giriş yoksa kilit ve giriş görünümü gösterir.
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
        newOptions: Bundle
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
        private const val DAY_MS = 86_400_000.0
        private const val HOME_URL = "couplesapp:///home"
        private const val PAYWALL_URL = "couplesapp:///paywall"

        // Yerleşim eşikleri (dp). Android 12+ eşlemesinde de aynı değerler kullanılır.
        // Yatay yerleşimler 4 hücre genişliği ister (70n - 30 = 250dp); daha dar widget dikey küçük yerleşimi alır.
        private const val SMALL_MIN_DP = 110f
        private const val MEDIUM_MIN_WIDTH_DP = 250
        private const val LARGE_MIN_HEIGHT_DP = 200

        private val TURKISH = Locale("tr", "TR")

        /** Her yerleşimdeki fotoğrafın (halka içi) çapı, dp. */
        private enum class SizeClass(val avatarDp: Int, val layout: Int) {
            SMALL(38, R.layout.couple_widget_small),
            MEDIUM(54, R.layout.couple_widget),
            LARGE(78, R.layout.couple_widget_large)
        }

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
                // Çizim hatası widget'ı boş bırakmasın: en azından uygulama mesajı göster
                try {
                    manager.updateAppWidget(id, fallbackViews(context))
                } catch (ignored: Throwable) {
                }
            }
        }

        // ─── Veri ──────────────────────────────────────────────────────────────────

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
            val signedOut = WidgetData("signedOut", "", "", null, null, null, null, null, null, null)
            val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(DATA_KEY, null)
            if (raw.isNullOrEmpty()) return signedOut
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
                signedOut
            }
        }

        private fun isLocked(data: WidgetData): Boolean {
            if (data.state == "locked") return true
            val until = data.premiumUntilMs
            return data.state == "ready" && until != null && until <= System.currentTimeMillis()
        }

        // ─── Tarih hesapları ───────────────────────────────────────────────────────

        private fun startOfToday(): Calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        private fun todayKey(): String {
            val c = Calendar.getInstance()
            return String.format(
                Locale.US,
                "%04d-%02d-%02d",
                c.get(Calendar.YEAR),
                c.get(Calendar.MONTH) + 1,
                c.get(Calendar.DAY_OF_MONTH)
            )
        }

        private fun parseStart(startDate: String?): Calendar? {
            val parts = startDate?.split("-") ?: return null
            if (parts.size != 3) return null
            return try {
                Calendar.getInstance().apply {
                    clear()
                    set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt(), 0, 0, 0)
                }
            } catch (ignored: Throwable) {
                null
            }
        }

        private fun daysBetween(from: Calendar, to: Calendar): Long =
            ((to.timeInMillis - from.timeInMillis) / DAY_MS).roundToLong()

        /** Uygulamadaki sayaçla aynı: bugünün başlangıcı - başlangıç günü, negatif olamaz. */
        private fun daysSince(start: Calendar?): Long? = start?.let { max(0L, daysBetween(it, startOfToday())) }

        private fun group(n: Long): String = String.format(TURKISH, "%,d", n)

        /** Sıradaki dönüm noktası: yıl dönümü ya da bir sonraki 100'ün katı gün (hangisi yakınsa). */
        private fun milestoneText(start: Calendar?, days: Long?): String? {
            if (start == null || days == null) return null
            val today = startOfToday()
            val month = start.get(Calendar.MONTH)
            val day = start.get(Calendar.DAY_OF_MONTH)
            fun anniversaryIn(year: Int): Calendar = Calendar.getInstance().apply {
                clear()
                set(year, month, 1, 0, 0, 0)
                // 29 Şubat'ta başlayan ilişkinin yıl dönümü artık olmayan yıllarda 28 Şubat'tır
                set(Calendar.DAY_OF_MONTH, min(day, getActualMaximum(Calendar.DAY_OF_MONTH)))
            }

            var year = today.get(Calendar.YEAR)
            var anniversary = anniversaryIn(year)
            if (anniversary.before(today)) {
                year += 1
                anniversary = anniversaryIn(year)
            }
            val toAnniversary = daysBetween(today, anniversary)
            val years = year - start.get(Calendar.YEAR)
            val next100 = (days / 100 + 1) * 100
            val toNext100 = next100 - days

            return when {
                years >= 1 && toAnniversary == 0L -> "🎉 $years. yıl dönümünüz kutlu olsun"
                days > 0 && days % 100 == 0L -> "🎉 Bugün ${group(days)}. gününüz"
                years >= 1 && toAnniversary <= toNext100 -> "🎂 $years. yıl dönümüne $toAnniversary gün"
                else -> "✨ ${group(next100)}. güne $toNext100 gün"
            }
        }

        // ─── Fotoğraflar ───────────────────────────────────────────────────────────

        /** Aynı fotoğraf her yerleşim için yeniden okunmasın: çizim başına bir kez çözülür. */
        private class PhotoLoader(private val maxSidePx: Int) {
            private val sources = HashMap<String, Bitmap?>()

            fun circle(path: String?, sizePx: Int): Bitmap? {
                if (path.isNullOrEmpty()) return null
                val source = sources.getOrPut(path) { decode(path) } ?: return null
                return try {
                    circleCrop(source, sizePx)
                } catch (ignored: Throwable) {
                    null
                }
            }

            fun release() {
                for (bitmap in sources.values) bitmap?.recycle()
                sources.clear()
            }

            private fun decode(path: String): Bitmap? = try {
                val cleanPath = if (path.startsWith("file://")) Uri.parse(path).path else path
                val file = File(cleanPath ?: "")
                if (!file.exists()) {
                    null
                } else {
                    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    BitmapFactory.decodeFile(file.path, bounds)
                    var sample = 1
                    while (bounds.outWidth / (sample * 2) >= maxSidePx && bounds.outHeight / (sample * 2) >= maxSidePx) {
                        sample *= 2
                    }
                    BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample })
                }
            } catch (ignored: Throwable) {
                null
            }

            private fun circleCrop(source: Bitmap, sizePx: Int): Bitmap {
                val side = min(source.width, source.height)
                val output = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(output)
                val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
                canvas.drawCircle(sizePx / 2f, sizePx / 2f, sizePx / 2f, paint)
                paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
                val srcRect = Rect(
                    (source.width - side) / 2,
                    (source.height - side) / 2,
                    (source.width + side) / 2,
                    (source.height + side) / 2
                )
                canvas.drawBitmap(source, srcRect, Rect(0, 0, sizePx, sizePx), paint)
                return output
            }
        }

        private fun bindAvatar(views: RemoteViews, imageId: Int, initialId: Int, bitmap: Bitmap?, name: String) {
            views.setTextViewText(initialId, name.trim().take(1).uppercase(TURKISH).ifEmpty { "♥" })
            if (bitmap != null) {
                views.setImageViewBitmap(imageId, bitmap)
                views.setViewVisibility(imageId, View.VISIBLE)
            } else {
                views.setViewVisibility(imageId, View.GONE)
            }
        }

        // ─── Çizim ─────────────────────────────────────────────────────────────────

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

        private fun setOptionalText(views: RemoteViews, viewId: Int, text: String?) {
            if (text.isNullOrEmpty()) {
                views.setViewVisibility(viewId, View.GONE)
            } else {
                views.setTextViewText(viewId, text)
                views.setViewVisibility(viewId, View.VISIBLE)
            }
        }

        private fun bindMessage(context: Context, views: RemoteViews, size: SizeClass, locked: Boolean) {
            views.setViewVisibility(R.id.content_group, View.GONE)
            views.setViewVisibility(R.id.message_group, View.VISIBLE)
            val small = size == SizeClass.SMALL
            if (locked) {
                views.setTextViewText(R.id.message_emoji, "👑")
                views.setTextViewText(R.id.message_title, "Premium üyelere özel")
                views.setTextViewText(R.id.message_sub, if (small) "Premium’a geç" else "Sayacınızı ana ekranda ve kilit ekranında görün")
                setOptionalText(views, R.id.message_cta, if (small) null else "Premium’a geç 👑")
                views.setOnClickPendingIntent(android.R.id.background, clickIntent(context, PAYWALL_URL, 1))
            } else {
                views.setTextViewText(R.id.message_emoji, "♥")
                views.setTextViewText(R.id.message_title, "Couples App")
                views.setTextViewText(R.id.message_sub, "Widget için giriş yap")
                setOptionalText(views, R.id.message_cta, if (small) null else "Uygulamayı aç")
                views.setOnClickPendingIntent(android.R.id.background, clickIntent(context, HOME_URL, 0))
            }
        }

        private fun build(
            context: Context,
            data: WidgetData,
            size: SizeClass,
            photos: PhotoLoader,
            density: Float
        ): RemoteViews {
            val views = RemoteViews(context.packageName, size.layout)

            val locked = isLocked(data)
            if (data.state != "ready" || locked) {
                bindMessage(context, views, size, locked)
                return views
            }

            views.setViewVisibility(R.id.content_group, View.VISIBLE)
            views.setViewVisibility(R.id.message_group, View.GONE)

            val avatarPx = (size.avatarDp * density).toInt()
            bindAvatar(views, R.id.avatar_me_img, R.id.avatar_me_initial, photos.circle(data.myAvatar, avatarPx), data.myName)
            bindAvatar(
                views, R.id.avatar_partner_img, R.id.avatar_partner_initial,
                photos.circle(data.partnerAvatar, avatarPx), data.partnerName
            )

            val start = parseStart(data.startDate)
            val days = daysSince(start)
            val names = if (data.myName.isNotEmpty()) "${data.myName} & ${data.partnerName}" else data.partnerName
            val small = size == SizeClass.SMALL

            views.setTextViewText(R.id.widget_days, days?.let { group(it) } ?: "—")
            views.setViewVisibility(R.id.widget_days_unit, if (days != null && !small) View.VISIBLE else View.GONE)
            views.setTextViewText(
                R.id.widget_days_label,
                when {
                    days == null && small -> "Tarihinizi ekleyin"
                    days == null -> "Tarihinizi uygulamadan ekleyin"
                    small -> "gündür birlikte ♥"
                    else -> "birlikte ♥ $names"
                }
            )

            // Ruh hali yalnızca ait olduğu gün gösterilir (dünkü ruh hali bugün yanlış olur)
            val mood = if (!data.moodEmoji.isNullOrEmpty() && data.moodDate == todayKey()) {
                buildString {
                    append(data.moodEmoji).append(' ').append(data.partnerName)
                    if (!data.moodLabel.isNullOrEmpty()) append(" · ").append(data.moodLabel)
                }
            } else {
                null
            }
            val milestone = milestoneText(start, days)

            when (size) {
                SizeClass.SMALL -> {
                    setOptionalText(views, R.id.widget_detail, mood ?: milestone)
                    setOptionalText(views, R.id.chip_mood, null)
                    setOptionalText(views, R.id.chip_milestone, null)
                }
                SizeClass.MEDIUM -> {
                    // Orta boyda tek kart sığar: bugünkü ruh hali öncelikli
                    setOptionalText(views, R.id.widget_detail, null)
                    setOptionalText(views, R.id.chip_mood, mood)
                    setOptionalText(views, R.id.chip_milestone, if (mood == null) milestone else null)
                }
                SizeClass.LARGE -> {
                    setOptionalText(views, R.id.widget_detail, null)
                    setOptionalText(views, R.id.chip_mood, mood)
                    setOptionalText(views, R.id.chip_milestone, milestone)
                }
            }

            views.setOnClickPendingIntent(android.R.id.background, clickIntent(context, HOME_URL, 0))
            return views
        }

        /** Android 12 öncesi: başlatıcının bildirdiği dikey yöndeki boyuta göre yerleşim seçilir. */
        private fun sizeClassFor(options: Bundle): SizeClass {
            val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
            val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
            return when {
                width in 1 until MEDIUM_MIN_WIDTH_DP -> SizeClass.SMALL
                height >= LARGE_MIN_HEIGHT_DP -> SizeClass.LARGE
                else -> SizeClass.MEDIUM
            }
        }

        private fun render(context: Context, manager: AppWidgetManager, id: Int) {
            val data = readData(context)
            val density = context.resources.displayMetrics.density
            val photos = PhotoLoader((SizeClass.LARGE.avatarDp * density).toInt())
            try {
                val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    // Başlatıcı ya da kilit ekranı, widget'ın gerçek boyutuna en uygun yerleşimi kendisi seçer
                    RemoteViews(
                        mapOf(
                            SizeF(SMALL_MIN_DP, SMALL_MIN_DP) to build(context, data, SizeClass.SMALL, photos, density),
                            SizeF(MEDIUM_MIN_WIDTH_DP.toFloat(), SMALL_MIN_DP) to
                                build(context, data, SizeClass.MEDIUM, photos, density),
                            SizeF(MEDIUM_MIN_WIDTH_DP.toFloat(), LARGE_MIN_HEIGHT_DP.toFloat()) to
                                build(context, data, SizeClass.LARGE, photos, density)
                        )
                    )
                } else {
                    build(context, data, sizeClassFor(manager.getAppWidgetOptions(id)), photos, density)
                }
                manager.updateAppWidget(id, views)
            } finally {
                // Kırpılmış kopyalar RemoteViews'a aittir; yalnızca çözülen kaynaklar bırakılır
                photos.release()
            }
        }

        private fun fallbackViews(context: Context): RemoteViews {
            val views = RemoteViews(context.packageName, SizeClass.MEDIUM.layout)
            views.setViewVisibility(R.id.content_group, View.GONE)
            views.setViewVisibility(R.id.message_group, View.VISIBLE)
            views.setTextViewText(R.id.message_emoji, "♥")
            views.setTextViewText(R.id.message_title, "Couples App")
            views.setTextViewText(R.id.message_sub, "Açmak için dokun")
            views.setOnClickPendingIntent(android.R.id.background, clickIntent(context, HOME_URL, 0))
            return views
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

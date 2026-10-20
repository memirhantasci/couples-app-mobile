package __PACKAGE__

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** JS köprüsü: payload'ı SharedPreferences'a yazar ve açık widget'ları yeniler. */
class CoupleWidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CoupleWidgetModule"

    @ReactMethod
    fun updateWidget(jsonStr: String, promise: Promise) {
        try {
            reactContext
                .getSharedPreferences(CoupleWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(CoupleWidgetProvider.DATA_KEY, jsonStr)
                .apply()
            CoupleWidgetProvider.refreshAll(reactContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message, e)
        }
    }
}

const { withAndroidManifest, withDangerousMod, withMainApplication } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo Config Plugin to ensure Android AppWidget resources and Native Modules
 * are automatically generated during `expo prebuild` / EAS Build.
 */
module.exports = function withAndroidWidget(config) {
  // 1. AndroidManifest.xml'e Receiver Ekle
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    const hasReceiver = mainApplication.receiver.some(
      (r) => r.$?.["android:name"] === ".CoupleWidgetProvider"
    );

    if (!hasReceiver) {
      mainApplication.receiver.push({
        $: {
          "android:name": ".CoupleWidgetProvider",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name": "android.appwidget.action.APPWIDGET_UPDATE",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.appwidget.provider",
              "android:resource": "@xml/couple_widget_info",
            },
          },
        ],
      });
    }

    return config;
  });

  // 2. MainApplication.kt içine Package Ekle
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes("CoupleWidgetPackage()")) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        "PackageList(this).packages.apply {\n          add(CoupleWidgetPackage())"
      );
      config.modResults.contents = contents;
    }
    return config;
  });

  // 3. Android AppWidget XML ve Kotlin Kaynak Dosyalarını Otomatik Oluştur
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const androidRoot =
        config.modRequest.platformProjectRoot ||
        path.join(config.modRequest.projectRoot, "android");

      const packageName =
        config.android?.package || "com.memirhantasci.couplesapp";
      const packagePath = packageName.replace(/\./g, "/");

      const resXmlDir = path.join(androidRoot, "app", "src", "main", "res", "xml");
      const resLayoutDir = path.join(
        androidRoot,
        "app",
        "src",
        "main",
        "res",
        "layout"
      );
      const javaDir = path.join(
        androidRoot,
        "app",
        "src",
        "main",
        "java",
        packagePath
      );

      fs.mkdirSync(resXmlDir, { recursive: true });
      fs.mkdirSync(resLayoutDir, { recursive: true });
      fs.mkdirSync(javaDir, { recursive: true });

      // 3a. res/xml/couple_widget_info.xml
      const widgetInfoXml = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="86400000"
    android:initialLayout="@layout/couple_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen">
</appwidget-provider>
`;
      fs.writeFileSync(
        path.join(resXmlDir, "couple_widget_info.xml"),
        widgetInfoXml,
        "utf8"
      );

      // 3b. res/layout/couple_widget.xml
      const widgetLayoutXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp"
    android:background="@android:color/black">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <TextView
            android:id="@+id/widget_app_title"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="Couples App ❤️"
            android:textColor="#FFFFFF"
            android:textSize="14sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/widget_days"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="142. Gün"
            android:textColor="#FF4D6D"
            android:textSize="14sp"
            android:textStyle="bold" />
    </LinearLayout>

    <TextView
        android:id="@+id/widget_mood"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="🥰 Sevgilin: Aşk Dolu"
        android:textColor="#E0E0E0"
        android:textSize="13sp" />

    <TextView
        android:id="@+id/widget_note"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:text="Bugün birbirinize sarılmayı unutmayın 🌸"
        android:textColor="#A0A0A0"
        android:textSize="12sp"
        android:maxLines="2" />

    <TextView
        android:id="@+id/widget_footer"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="6dp"
        android:gravity="end"
        android:text="Uygulamayı Aç ›"
        android:textColor="#888888"
        android:textSize="11sp" />
</LinearLayout>
`;
      fs.writeFileSync(
        path.join(resLayoutDir, "couple_widget.xml"),
        widgetLayoutXml,
        "utf8"
      );

      // 3c. CoupleWidgetProvider.kt
      const providerKt = `package ${packageName}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject

class CoupleWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        const val PREFS_NAME = "CoupleWidgetPrefs"
        const val DATA_KEY = "widget_data"

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val jsonStr = prefs.getString(DATA_KEY, null)

            var days = "142. Gün"
            var mood = "🥰 Sevgilin: Aşk Dolu"
            var note = "Bugün birbirinize sarılmayı unutmayın 🌸"

            if (!jsonStr.isNullOrEmpty()) {
                try {
                    val obj = JSONObject(jsonStr)
                    val partnerName = obj.optString("partnerName", "Sevgilin")
                    val daysTogether = obj.optInt("daysTogether", 0)
                    val moodEmoji = obj.optString("moodEmoji", "🥰")
                    val moodLabel = obj.optString("moodLabel", "Aşk Dolu")
                    val dailyNote = obj.optString("dailyNote", "")
                    val nextMeetingTitle = obj.optString("nextMeetingTitle", "")

                    if (daysTogether > 0) {
                        days = "\${daysTogether}. Gün"
                    }
                    mood = "$moodEmoji $partnerName: $moodLabel"
                    note = when {
                        dailyNote.isNotEmpty() -> dailyNote
                        nextMeetingTitle.isNotEmpty() -> nextMeetingTitle
                        else -> "Bugün birbirinize sarılmayı unutmayın 🌸"
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            val views = RemoteViews(context.packageName, R.layout.couple_widget)
            views.setTextViewText(R.id.widget_days, days)
            views.setTextViewText(R.id.widget_mood, mood)
            views.setTextViewText(R.id.widget_note, note)

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_container, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
`;
      fs.writeFileSync(
        path.join(javaDir, "CoupleWidgetProvider.kt"),
        providerKt,
        "utf8"
      );

      // 3d. CoupleWidgetModule.kt
      const moduleKt = `package ${packageName}

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CoupleWidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CoupleWidgetModule"

    @ReactMethod
    fun updateWidget(jsonStr: String, promise: Promise? = null) {
        try {
            val prefs = reactContext.getSharedPreferences(
                CoupleWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            prefs.edit().putString(CoupleWidgetProvider.DATA_KEY, jsonStr).apply()

            val appWidgetManager = AppWidgetManager.getInstance(reactContext)
            val componentName = ComponentName(reactContext, CoupleWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

            for (id in appWidgetIds) {
                CoupleWidgetProvider.updateAppWidget(reactContext, appWidgetManager, id)
            }
            promise?.resolve(true)
        } catch (e: Exception) {
            promise?.reject("WIDGET_ERROR", e.message, e)
        }
    }
}
`;
      fs.writeFileSync(
        path.join(javaDir, "CoupleWidgetModule.kt"),
        moduleKt,
        "utf8"
      );

      // 3e. CoupleWidgetPackage.kt
      const packageKt = `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class CoupleWidgetPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(CoupleWidgetModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;
      fs.writeFileSync(
        path.join(javaDir, "CoupleWidgetPackage.kt"),
        packageKt,
        "utf8"
      );

      return config;
    },
  ]);

  return config;
};

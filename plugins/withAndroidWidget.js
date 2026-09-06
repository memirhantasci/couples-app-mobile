const { withAndroidManifest, withDangerousMod, withMainApplication } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo Config Plugin to ensure Android AppWidget and Native Modules
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

  return config;
};

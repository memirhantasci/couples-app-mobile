/* global __dirname */
const { withAndroidManifest, withDangerousMod, withMainApplication } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Android ana ekran widget'ı için Expo Config Plugin (expo-widgets yalnızca iOS'u destekler).
 *
 * Kaynak dosyalar `plugins/android-widget/` altında gerçek Kotlin/XML olarak durur:
 *   - *.kt            → android/app/src/main/java/<paket>/   (`__PACKAGE__` paket adıyla değiştirilir)
 *   - res/**          → android/app/src/main/res/
 *   - couple_widget.xml iki kez yazılır: nötr ilk yerleşim ve widget seçicideki örnek önizleme.
 */
const SOURCE_DIR = path.join(__dirname, "android-widget");
const RECEIVER_NAME = ".CoupleWidgetProvider";
const KOTLIN_FILES = ["CoupleWidgetProvider.kt", "CoupleWidgetModule.kt", "CoupleWidgetPackage.kt"];

function getPackageName(config) {
  const pkg = config.android && config.android.package;
  if (!pkg) throw new Error("[withAndroidWidget] android.package app.json içinde tanımlı olmalı.");
  return pkg;
}

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDirectory(source, target);
    else fs.copyFileSync(source, target);
  }
}

module.exports = function withAndroidWidget(config) {
  // 1. AndroidManifest.xml: widget alıcısı (yenileme + tarih/saat değişimi yayınları)
  config = withAndroidManifest(config, (cfg) => {
    const packageName = getPackageName(cfg);
    const application = cfg.modResults.manifest.application[0];
    application.receiver = (application.receiver || []).filter(
      (r) => r.$ && r.$["android:name"] !== RECEIVER_NAME
    );

    application.receiver.push({
      $: {
        "android:name": RECEIVER_NAME,
        "android:exported": "true",
        "android:label": "Aşkımızın Yolculuğu",
      },
      "intent-filter": [
        {
          action: [
            { $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } },
            { $: { "android:name": "android.intent.action.DATE_CHANGED" } },
            { $: { "android:name": "android.intent.action.TIME_SET" } },
            { $: { "android:name": "android.intent.action.TIMEZONE_CHANGED" } },
            { $: { "android:name": `${packageName}.WIDGET_REFRESH` } },
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
    return cfg;
  });

  // 2. MainApplication.kt: JS köprü paketini kaydet
  config = withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes("CoupleWidgetPackage()")) {
      const pattern = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (!pattern.test(contents)) {
        throw new Error(
          "[withAndroidWidget] MainApplication.kt içinde `PackageList(this).packages.apply {` bulunamadı; " +
            "şablon değişmiş olabilir. CoupleWidgetPackage() elle eklenmeli."
        );
      }
      contents = contents.replace(pattern, (match) => `${match}\n          add(CoupleWidgetPackage())`);
      cfg.modResults.contents = contents;
    }
    return cfg;
  });

  // 3. Kotlin ve res dosyalarını yaz
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const packageName = getPackageName(cfg);
      const androidRoot = cfg.modRequest.platformProjectRoot;
      const mainDir = path.join(androidRoot, "app", "src", "main");
      const javaDir = path.join(mainDir, "java", ...packageName.split("."));

      fs.mkdirSync(javaDir, { recursive: true });
      for (const file of KOTLIN_FILES) {
        const source = fs.readFileSync(path.join(SOURCE_DIR, file), "utf8");
        fs.writeFileSync(path.join(javaDir, file), source.split("__PACKAGE__").join(packageName), "utf8");
      }

      const resSource = path.join(SOURCE_DIR, "res");
      const resTarget = path.join(mainDir, "res");
      copyDirectory(resSource, resTarget);

      // Orta boy yerleşim: ilk yükleme nötr ("—"), widget seçici önizlemesi örnek veriyle
      const template = fs.readFileSync(path.join(resSource, "layout", "couple_widget.xml"), "utf8");
      const label = "gündür birlikte ❤️";
      const layoutDir = path.join(resTarget, "layout");
      fs.writeFileSync(
        path.join(layoutDir, "couple_widget.xml"),
        template.split("__DAYS__").join("—").split("__LABEL__").join(label),
        "utf8"
      );
      fs.writeFileSync(
        path.join(layoutDir, "couple_widget_preview.xml"),
        template.split("__DAYS__").join("142").split("__LABEL__").join(label),
        "utf8"
      );

      return cfg;
    },
  ]);

  return config;
};

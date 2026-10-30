// Uygulama içi yasal metinleri (src/constants/legalTexts.ts) mağaza formları için herkese açık HTML sayfalarına çevirir.
// Türkçe sayfalar docs/legal/*.html (mevcut adresler korunur), İngilizce sayfalar docs/legal/en/*.html altına yazılır.
// Kullanım: node scripts/build-legal-pages.js  →  docs/legal/*.html ve docs/legal/en/*.html
// Yayınlamak için GitHub Pages'i "main /docs" olarak açın: https://<kullanıcı>.github.io/<repo>/legal/privacy.html
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const APP_NAME = "CoupleSky";
const baseDir = path.join(__dirname, "..", "docs", "legal");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "constants", "legalTexts.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const mod = { exports: {} };
// legalTexts.ts uygulama dilini @/lib/i18n'den okur; derleme sırasında dil açıkça verildiğinden yalnızca yer tutucu gerekir
const stubRequire = (id) => {
  if (id === "@/lib/i18n") return { __esModule: true, default: { language: "tr" } };
  return require(id);
};
new Function("module", "exports", "require", js)(mod, mod.exports, stubRequire);
const { getLegalDocs } = mod.exports;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isHeading = (line) => /^\d+\.\s+[A-ZÇĞİÖŞÜ0-9 ,.'’()\-/&]+$/.test(line.split("\n")[0]) && !line.includes("\n");

const style = `
  :root{color-scheme:light dark}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.65;max-width:760px;margin:0 auto;padding:24px 16px 64px;background:#fff;color:#1b1b1f}
  @media(prefers-color-scheme:dark){body{background:#121215;color:#ececf1}a{color:#ff7a95}}
  h1{font-size:1.7rem;margin-bottom:.25rem}h2{font-size:1.1rem;margin-top:2rem}
  .meta{color:#777;font-size:.9rem;margin-bottom:1.5rem}nav a{margin-right:12px;font-size:.9rem}
  .lang{float:right}.lang a{margin:0 0 0 8px}
  p{white-space:pre-line}`;

// Dile özgü sabit metinler (iletişim adresleri: Türkçe → destek@, İngilizce → support@)
const LANGS = {
  tr: {
    htmlLang: "tr",
    dir: baseDir,
    prefix: "",
    otherHref: "en/",
    otherLabel: "English",
    supportEmail: "destek@couplesky.app",
    supportLabel: "Destek",
    lastUpdated: "Son güncelleme",
    indexTitle: "Yasal Belgeler",
    indexMeta: "Yasal belgeler ve destek",
    supportIntro:
      "Bir sorun yaşıyorsanız, önerileriniz varsa ya da hesabınızla ilgili bir talebiniz (veri erişimi, silme) bulunuyorsa bize e-posta ile ulaşabilirsiniz:",
    supportBody:
      '<h2>Hesabımı nasıl silerim?</h2><p>Uygulamada Profil → Hesap Yönetimi bölümünden "Hesabımı ve Tüm Verileri Sil" seçeneğini kullanabilirsiniz. Talep 7 gün beklemeye alınır; bu süre içinde giriş yaparak vazgeçebilirsiniz. Süre sonunda hesabınız ve tüm verileriniz kalıcı olarak silinir.</p>' +
      "<h2>Aboneliğimi nasıl iptal ederim?</h2><p>Abonelikler App Store veya Google Play üzerinden yönetilir. iOS: Ayarlar → Apple Kimliği → Abonelikler. Android: Google Play → Profil → Ödemeler ve abonelikler → Abonelikler.</p>",
  },
  en: {
    htmlLang: "en",
    dir: path.join(baseDir, "en"),
    prefix: "",
    otherHref: "../",
    otherLabel: "Türkçe",
    supportEmail: "support@couplesky.app",
    supportLabel: "Support",
    lastUpdated: "Last updated",
    indexTitle: "Legal Documents",
    indexMeta: "Legal documents and support",
    supportIntro:
      "If you run into a problem, have a suggestion, or have a request about your account (data access, deletion), you can reach us by email:",
    supportBody:
      '<h2>How do I delete my account?</h2><p>In the app, go to Settings → Account Management & Danger Zone and choose "Delete My Account and All Data". The request is held for 7 days; you can cancel by signing in during that time. After that, your account and all your data are permanently deleted.</p>' +
      "<h2>How do I cancel my subscription?</h2><p>Subscriptions are managed through the App Store or Google Play. iOS: Settings → Apple ID → Subscriptions. Android: Google Play → Profile → Payments & subscriptions → Subscriptions.</p>",
  },
};

for (const [lang, L] of Object.entries(LANGS)) {
  const docs = getLegalDocs(lang);
  const nav = (current) =>
    `<nav><span class="lang"><a href="${L.otherHref}${current && current !== "support" ? current + ".html" : current === "support" ? "support.html" : ""}">${L.otherLabel}</a></span>` +
    Object.values(docs).map((d) => `<a href="${d.id}.html"${d.id === current ? ' aria-current="page"' : ""}>${esc(d.title)}</a>`).join("") +
    `<a href="support.html"${current === "support" ? ' aria-current="page"' : ""}>${L.supportLabel}</a></nav>`;

  const page = (title, body, current) =>
    `<!doctype html><html lang="${L.htmlLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · ${APP_NAME}</title><style>${style}</style></head><body>${nav(current)}${body}</body></html>`;

  fs.mkdirSync(L.dir, { recursive: true });

  for (const doc of Object.values(docs)) {
    const body =
      `<h1>${esc(doc.title)}</h1><div class="meta">${esc(doc.badge)} · ${L.lastUpdated}: ${esc(doc.lastUpdated)}</div><p>${esc(doc.summary)}</p>` +
      doc.content.map((line) => (isHeading(line) ? `<h2>${esc(line)}</h2>` : `<p>${esc(line)}</p>`)).join("");
    fs.writeFileSync(path.join(L.dir, `${doc.id}.html`), page(doc.title, body, doc.id));
  }

  const supportBody =
    `<h1>${L.supportLabel}</h1><div class="meta">${APP_NAME}</div>` +
    `<p>${L.supportIntro}</p>` +
    `<p><a href="mailto:${L.supportEmail}">${L.supportEmail}</a></p>` +
    L.supportBody;
  fs.writeFileSync(path.join(L.dir, "support.html"), page(L.supportLabel, supportBody, "support"));

  const index =
    `<h1>${APP_NAME}</h1><div class="meta">${L.indexMeta}</div><ul>` +
    Object.values(docs).map((d) => `<li><a href="${d.id}.html">${esc(d.title)}</a></li>`).join("") +
    `<li><a href="support.html">${L.supportLabel}</a></li></ul>`;
  fs.writeFileSync(path.join(L.dir, "index.html"), page(L.indexTitle, index, ""));

  console.log(`[${lang}] Üretilen sayfalar:`, fs.readdirSync(L.dir).filter((f) => f.endsWith(".html")).join(", "));
}

// Uygulama içi yasal metinleri (src/constants/legalTexts.ts) mağaza formları için herkese açık HTML sayfalarına çevirir.
// Kullanım: node scripts/build-legal-pages.js  →  docs/legal/*.html
// Yayınlamak için GitHub Pages'i "main /docs" olarak açın: https://<kullanıcı>.github.io/<repo>/legal/privacy.html
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const SUPPORT_EMAIL = "emirhanekin94@gmail.com";
const outDir = path.join(__dirname, "..", "docs", "legal");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "constants", "legalTexts.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", js)(mod, mod.exports);
const docs = mod.exports.LEGAL_DOCS;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isHeading = (line) => /^\d+\.\s+[A-ZÇĞİÖŞÜ0-9 ,.'’()\-/&]+$/.test(line.split("\n")[0]) && !line.includes("\n");

const style = `
  :root{color-scheme:light dark}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.65;max-width:760px;margin:0 auto;padding:24px 16px 64px;background:#fff;color:#1b1b1f}
  @media(prefers-color-scheme:dark){body{background:#121215;color:#ececf1}a{color:#ff7a95}}
  h1{font-size:1.7rem;margin-bottom:.25rem}h2{font-size:1.1rem;margin-top:2rem}
  .meta{color:#777;font-size:.9rem;margin-bottom:1.5rem}nav a{margin-right:12px;font-size:.9rem}
  p{white-space:pre-line}`;

const nav = (current) =>
  "<nav>" +
  Object.values(docs).map((d) => `<a href="${d.id}.html"${d.id === current ? ' aria-current="page"' : ""}>${esc(d.title)}</a>`).join("") +
  '<a href="support.html">Destek</a></nav>';

const page = (title, body, current) =>
  `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Couples App</title><style>${style}</style></head><body>${nav(current)}${body}</body></html>`;

fs.mkdirSync(outDir, { recursive: true });

for (const doc of Object.values(docs)) {
  const body =
    `<h1>${esc(doc.title)}</h1><div class="meta">${esc(doc.badge)} · Son güncelleme: ${esc(doc.lastUpdated)}</div><p>${esc(doc.summary)}</p>` +
    doc.content.map((line) => (isHeading(line) ? `<h2>${esc(line)}</h2>` : `<p>${esc(line)}</p>`)).join("");
  fs.writeFileSync(path.join(outDir, `${doc.id}.html`), page(doc.title, body, doc.id));
}

const supportBody =
  `<h1>Destek</h1><div class="meta">Couples App</div>` +
  `<p>Bir sorun yaşıyorsanız, önerileriniz varsa ya da hesabınızla ilgili bir talebiniz (veri erişimi, silme) bulunuyorsa bize e-posta ile ulaşabilirsiniz:</p>` +
  `<p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>` +
  `<h2>Hesabımı nasıl silerim?</h2><p>Uygulamada Profil → Hesap Yönetimi bölümünden "Hesabımı ve Tüm Verileri Sil" seçeneğini kullanabilirsiniz. Talep 7 gün beklemeye alınır; bu süre içinde giriş yaparak vazgeçebilirsiniz. Süre sonunda hesabınız ve tüm verileriniz kalıcı olarak silinir.</p>` +
  `<h2>Aboneliğimi nasıl iptal ederim?</h2><p>Abonelikler App Store veya Google Play üzerinden yönetilir. iOS: Ayarlar → Apple Kimliği → Abonelikler. Android: Google Play → Profil → Ödemeler ve abonelikler → Abonelikler.</p>`;
fs.writeFileSync(path.join(outDir, "support.html"), page("Destek", supportBody, "support"));

const index =
  `<h1>Couples App</h1><div class="meta">Yasal belgeler ve destek</div><ul>` +
  Object.values(docs).map((d) => `<li><a href="${d.id}.html">${esc(d.title)}</a></li>`).join("") +
  `<li><a href="support.html">Destek</a></li></ul>`;
fs.writeFileSync(path.join(outDir, "index.html"), page("Yasal Belgeler", index, ""));

console.log("Üretilen sayfalar:", fs.readdirSync(outDir).join(", "));

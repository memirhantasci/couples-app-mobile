@AGENTS.md

# Özellik envanteri ve öneri kuralı

"Ne ekleyelim / ne geliştirelim" gibi bir soruda ya da yeni özellik önermeden önce **önce `docs/OZELLIKLER.md` dosyasını oku**.
Olan bir özelliği yeni diye önerme; 🔎 işaretli maddeleri kodla doğrulamadan "yok" deme. Öneri verirken şunları yaz: zaten olan ne,
hangi mevcut parçayla (ortak veri/an/duygu varsa) gerçekten bağlanır, çifte değeri, maliyet/risk, dayandığın dosya.
Bağ kurmak için bağ kurma; kalıp öneri verme; ilham verici ama mantıklı düşün. Özellik değişince `docs/OZELLIKLER.md`'yi güncelle.

# Bilgi grafı (graphify)

Projenin iki grafı var. Kod hakkında soru gelince dosyaları tek tek gezmeden önce grafa bak.
Sorgu: `py -m graphify query "<soru>" --graph <yol> --budget 1500`

- **AST grafı** (`graphify-out/graph.json`, her commit sonrası git kancası otomatik yeniler; `graphify-ast/` donmuş yedektir): yapısal, kesin bağlar (import, çağrı, tablo/RPC kullanımı) ve `docs/` notları. **Varsayılan budur.**
  Kullan: "kim çağırıyor", "hangi tabloya dokunuyor", "nereye bağlı", hata ayıklama, değişiklik öncesi etki analizi.
- **Anlamsal graf** (`graphify-semantic/graph.json`, AST ile birleşik; tahmin bağlar INFERRED işaretli): benzerlik ve niyet.
  Kullan: "benzer iş yapan başka yer var mı", "aynı mantık kaç yerde tekrarlanmış", "bu neden böyle yazılmış", "bu akışa hangi parçalar katılıyor".

Kurallar:
- Emin değilsen AST'den başla. AST yetmiyorsa anlamsala geçmekten **kaçınma**: cevap anlam/benzerlik/niyet istiyorsa doğrudan anlamsal grafa bak.
- INFERRED bağları kesin bilgi gibi sunma, tahmin olduğunu belirt ve kritik kararda kaynak dosyayı doğrula.
  Anlamsal graftaki `semantically_similar_to` kenarlarının puanı güvenilir bir sinyal değil (örnek kontrolde yüzeysel eşleşmeler 0.65 ve 0.75'te de çıktı, örn. menu↔index, micro_system_canvas↔star_service). Benzerlik doğrulama geçişi (graphify-sem/verify) bitene kadar benzerlik kenarını kanıt diye kullanma, kaynak kodu oku.
  Anlamsal çıkarım her kod grubunu ayrı işledi: klasörler arası tekrar (ör. `src/lib` ↔ `src/app`) grafta görünmeyebilir, yoksa "yok" deme, grep ile doğrula.
- AST grafı commit sonrası otomatik yenilenir; `graphify-semantic/` (anlamsal) **donmuştur**, kodla birlikte güncellenmez, bu yüzden güncel olmayan düğümler içerebilir. Doküman değişikliği için `/graphify . --update` gerekir. Grafta bulamazsan veya şüphen varsa grep/Read ile dosyaya git.
- `graphify-out/`, `graphify-ast/`, `graphify-sem/` git'e girmez (`.gitignore`).

# Web sitesi yasal metin güncellemeleri (hesap silme, tek kalma, Premium, hareketsiz hesap)

Bu liste `src/constants/legalTexts.ts` içindeki **mevcut** metinlerle karşılaştırılarak yazıldı. Her madde: **Hangi sayfa → hangi bölüm →
ESKİ metin → YENİ metin**. "EKLE" yazanlar yeni paragraf/maddedir. Türkçe metinlerin altında İngilizce karşılıkları var.
Sitede KVKK, Gizlilik, Kullanım Koşulları, Açık Rıza ve Abonelik sayfalarının hepsinde "Son güncelleme" tarihini değiştir.
Uygulamadaki davranış (`docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md`) hayata geçmeden bu metinleri YAYINLAMA: yanlış beyan olur.

---

## 1) KVKK AYDINLATMA METNİ

### 1.1 Bölüm 2 (İşlenen veri kategorileri) → "Cihaz ve İşlem Güvenliği" maddesi
**ESKİ:** "...benzersiz cihaz kimliği (UUID), son oturum açma zamanı, güvenlik logları ve giriş / şifre sıfırlama denemelerini sınırlamak için IP adresi (en fazla 1 gün tutulur)."

**YENİ:** "...benzersiz cihaz kimliği (UUID), son oturum açma ve **son uygulama kullanım zamanı**, güvenlik logları ve giriş / şifre sıfırlama denemelerini sınırlamak için IP adresi (en fazla 1 gün tutulur)."

### 1.2 Bölüm 2 → "Çift ve İlişki Bilgileri" maddesi (EKLE bir cümle)
**EKLE:** "Çift ilişkisi sona erdiğinde (partnerin hesabını silmesi gibi) tanışma ve sevgili olma tarihleri sıfırlanır; yeni bir eşleşmede yeniden girilir."

### 1.3 Bölüm 3 (İşlenme amaçları) → EKLE yeni madde
**EKLE:** "• Kullanılmayan, eşleşmemiş hesapların belirli süre sonunda silinmesi (saklama sınırlaması ilkesi) ve silmeden önce bildirim gönderilmesi."

### 1.4 Bölüm 3 → "İki partnerin özel eşleşme kodu ile birbirine bağlanması..." maddesi
**ESKİ:** "• İki partnerin özel eşleşme kodu ile birbirine bağlanması ve senkronize anı/takvim paylaşımı sağlanması,"

**YENİ:** "• İki partnerin özel eşleşme kodu ile birbirine bağlanması ve eşleşme anından sonra kaydedilen anı/takvim içeriğinin senkronize paylaşılması,"

### 1.5 Bölüm 7 (Veri saklama ve silme) → TAMAMEN DEĞİŞTİR, ilk paragraf
**ESKİ:** "Profil > Hesap Yönetimi & Tehlike Bölgesi bölümünden hesabınızı silme talebinde bulunabilirsiniz. Talep 7 gün beklemeye alınır; bu süre içinde aynı hesapla giriş yaparak talebi iptal edebilirsiniz. 7 gün sonunda hesabınıza ait profil bilgileri, dosyalar, günlükler ve mektuplar sunuculardan geri döndürülemez biçimde silinir. Partneriniz kendi hesabıyla kullanmaya devam eder; ortak anılar ise her iki taraftan da silinir ve partneriniz çiftten ayrılmış olur. Partnerinize silme talebi, vazgeçilmesi ve silinme durumunda uygulama içi açıklama ve bildirimle bilgi verilir. Yedek kopyalar en geç 30 gün içinde otomatik olarak imha edilir."

**YENİ:** "Profil > Hesap Yönetimi & Tehlike Bölgesi bölümünden hesabınızı silme talebinde bulunabilirsiniz. Talep 7 gün beklemeye alınır; bu süre içinde aynı hesapla giriş yaparak talebi iptal edebilirsiniz (giriş yaptığınızda talep otomatik iptal edilir ve size bilgi verilir). 7 gün sonunda **sizin oluşturduğunuz, yüklediğiniz veya yazdığınız her şey** (profil bilgileri, fotoğraflar, günlükler, mektuplar, notlar, özel günler, harita pinleri, ilaç ve döngü kayıtları ve yıldızınızdaki içerikler) sunuculardan geri döndürülemez biçimde silinir. **Partnerinizin hesabı silinmez**; partnerinizin kendi oluşturduğu içerikler yalnızca kendisi için saklanmaya devam eder. Ortak yıldız ve içindeki anı gezegenleri, kimin oluşturduğuna bakılmaksızın silinir; otomatik oluşturulan yıl dönümü kayıtları da silinir. Partnerinizin eşleşme kodu yenilenir ve partneriniz yeniden eşleşebilir. Partnerinize silme talebi, silinmeye 3 gün ve 1 gün kala hatırlatma, vazgeçilmesi ve silinme durumunda uygulama içi açıklama ve bildirimle bilgi verilir. Her iki taraf da silme talebinde bulunduysa her hesap kendi 7. gününde silinir; son silinen hesapla birlikte çifte ait kalan tüm kayıtlar ve dosyalar da kalıcı olarak silinir. Yedek kopyalar en geç 30 gün içinde otomatik olarak imha edilir."

### 1.6 Bölüm 7 → "Saklama süreleri" listesi
**ESKİ madde:** "• Hesap, profil ve ortak içerikler: Hesabınız silinene kadar (silme talebinden 7 gün sonra silinir),"

**YENİ:** "• Hesap, profil ve içerikler: Hesabınız silinene kadar (silme talebinden 7 gün sonra silinir). Partnerinizin oluşturduğu içerikler, siz silseniz de partnerinizin hesabı sürdükçe partnerinize aittir,"

**EKLE (yeni maddeler):**
- "• Kullanılmayan hesaplar: Hiç eşleşmemiş yeni kayıtlar son uygulama kullanımından 30 gün, bir çiftten ayrılıp tek kalan hesaplar son kullanımdan 60 gün sonra silinir. Aktif aboneliği olan hesaplar silinmez; abonelik sona erdikten 60 gün sonra silinir. Eşleşmiş kullanıcıların hesapları bu nedenle silinmez. Silmeden yaklaşık 7 gün ve 1 gün önce uygulama bildirimi gönderilir (bildirimleri kapattıysanız ulaşmayabilir),"
- "• Partnere gösterilen eski veriler: Yeni bir eşleşmede yeni partneriniz yalnızca eşleşme anından sonra kaydedilen verileri görür; önceki ilişkinize ait verileriniz yeni partnerinize gösterilmez ve yalnızca sizin erişiminizde kalır (siz dilediğinizde silebilirsiniz),"

### 1.7 Bölüm 7 → Yıldız kış uykusu maddesi (KONTROL ET)
Çift dağıldığında (partner silinince) yıldız ve gezegenler silinir; kış uykusu/kasa süreci **çift dağılan** durumda uygulanmaz.
**EKLE** "Yıldız tescili ve koordinatı" maddesinin sonuna: "Partnerinizin hesabını silmesi hâlinde yıldız ve içindeki anı gezegenleri kış uykusu/kasa süreci beklenmeden silinir ve yıldızın koordinatı boşa çıkar."

### 1.8 Bölüm 8 (Haklar) — değişiklik yok.

---

## 2) GİZLİLİK POLİTİKASI

### 2.1 Bölüm 2 → "İlişki ve Anı İçeriği" maddesi
**ESKİ:** "...Bu içerikler yalnızca siz ve eşleştiğiniz partneriniz tarafından görüntülenebilir."

**YENİ:** "...Bu içerikler yalnızca siz ve eşleştiğiniz partneriniz tarafından görüntülenebilir. Yeni bir eşleşmede partneriniz yalnızca eşleşme anından sonra kaydedilen içerikleri görür; önceki ilişkiye ait içerikleriniz yeni partnerinize gösterilmez."

### 2.2 Bölüm 2 → EKLE yeni madde (Kullanım zamanı)
**EKLE:** "• Kullanım Zamanı: Hesabınızın son kullanıldığı zaman. Yalnızca kullanılmayan, eşleşmemiş hesapları silebilmek için tutulur (Bölüm 5)."

### 2.3 Bölüm 5 (Hesap silme) → ilk paragraf
**ESKİ:** "...7 gün sonunda hesabınıza ait kayıtlar, dosyalar ve ortak anılar sunuculardan kalıcı olarak silinir ve geri getirilemez. Eşleştiğiniz partnere silme talebi, vazgeçilmesi ve silinme durumunda uygulama içi açıklama ve bildirimle bilgi verilir; ortak veriler her iki taraf için silinir."

**YENİ:** "...talebi iptal edebilir (giriş yapıldığında talep otomatik iptal edilir). 7 gün sonunda sizin oluşturduğunuz, yüklediğiniz veya yazdığınız her şey (kayıtlar, dosyalar, mektuplar, özel günler, harita pinleri ve yıldızınızdaki içerikler) sunuculardan kalıcı olarak silinir ve geri getirilemez. Partnerinizin hesabı silinmez ve partnerinizin kendi oluşturduğu içerikler yalnızca kendisi için saklanmaya devam eder. Ortak yıldız ve içindeki anı gezegenleri kimin oluşturduğuna bakılmaksızın silinir. Partnerinize silme talebi, silinmeye 3 gün ve 1 gün kala hatırlatma, vazgeçilmesi ve silinme durumunda uygulama içi açıklama ve bildirimle bilgi verilir. Her iki taraf da silme talebinde bulunduysa her hesap kendi 7. gününde silinir ve son hesap silindiğinde çifte ait kalan her şey de silinir."

### 2.4 Bölüm 5 → EKLE yeni paragraf (Kullanılmayan hesaplar)
**EKLE:** "Kullanılmayan hesaplar: Hiç eşleşmemiş yeni hesaplar son kullanımdan 30 gün, bir çiftten ayrılıp tek kalan hesaplar 60 gün sonra silinir; silmeden yaklaşık 7 gün ve 1 gün önce bildirim gönderilir. Aktif aboneliği olan hesaplar silinmez (abonelik bittikten 60 gün sonra silinir). Eşleşmiş hesaplar bu nedenle silinmez."

### 2.5 Bölüm 5 → EKLE paragraf (Abonelik)
**EKLE:** "Hesabınızı silmek mağazadaki (Apple/Google) aboneliğinizi iptal etmez; aboneliği mağaza hesabınızdan ayrıca iptal etmelisiniz."

### 2.6 Bölüm 5 → kış uykusu cümlesi
**EKLE sonuna:** "Partneriniz hesabını silerse yıldız ve gezegenler bu sürece girmeden silinir."

---

## 3) KULLANIM KOŞULLARI (EULA)

### 3.1 Bölüm 2 (Hizmetin kapsamı ve eşleşme) → EKLE
**EKLE:** "Yeni bir eşleşmede partner yalnızca eşleşme anından sonra kaydedilen içerikleri görür. Çift ilişkisi sona erdiğinde (örneğin partnerinizin hesabını silmesiyle) ortak yıldız ve içindeki gezegenler silinir; kendi oluşturduğunuz içerikler hesabınızda kalır. Tek kalan bir kullanıcı, eşleşme gerektiren özellikleri (fotoğraf, mektup, anı, buluşma ve yıldız) kullanmak için yeniden eşleşmelidir; Premium'a sahip tek kalan kullanıcı ruh hali, günlük, takvim notu, harita notu ve ilaç/döngü takibini kullanabilir."

### 3.2 Bölüm 7 (Fesih ve askıya alma) → EKLE paragraf
**EKLE:** "Kullanılmayan hesapların silinmesi: Hiç eşleşmemiş hesaplar 30 gün, çiftten ayrılıp tek kalan hesaplar 60 gün kullanılmazsa silinir (aktif aboneliği olan hesaplar hariç, bunlar abonelik bittikten 60 gün sonra silinir). Silmeden önce bildirim gönderilir. Eşleşmiş hesaplar bu nedenle silinmez."

### 3.3 Bölüm 3 (Hesap güvenliği) → EKLE
**EKLE:** "Hesabınızı silmeniz mağaza aboneliğinizi iptal etmez; aboneliği mağazadan iptal etmekten siz sorumlusunuz."

---

## 4) AÇIK RIZA METNİ

### 4.1 Bölüm 2 → "Çift Ortak Verisi" maddesi
**ESKİ:** "...yalnızca eşleştiğim partnerimle paylaşılmak üzere şifreli sunucularda saklanması,"

**YENİ:** "...yalnızca eşleştiğim partnerimle ve yalnızca eşleşme anından sonra kaydedilenler olmak üzere paylaşılmak üzere şifreli sunucularda saklanması; ilişkimin sona ermesi hâlinde kendi oluşturduğum verilerin yeni partnerimden gizli kalması,"

### 4.2 Bölüm 3 (Rızanın geri alınması) — değişiklik yok.

---

## 5) ABONELİK VE İADE KOŞULLARI

### 5.1 Bölüm 4 (İptal prosedürü) → son cümle
**ESKİ:** "Abonelik iki partner için ortak olduğundan, abonelik sona erdiğinde (iptal edilen dönemin bitiminde) partnerinizin Premium hakları da sona erer."

**YENİ:** "Abonelik iki partner için ortak olduğundan, abonelik sona erdiğinde (iptal edilen dönemin bitiminde) partnerinizin Premium hakları da sona erer. Hesabınızı silmek aboneliğinizi iptal etmez; iptal yalnızca mağaza hesabınızdan yapılır."

### 5.2 YENİ BÖLÜM EKLE (Bölüm 6'dan önce): "HESAP SİLME, TEK KALMA VE PREMIUM"
**EKLE (TR):**

"HESAP SİLME, AYRILMA VE PREMIUM'UN DURUMU
• Premium aboneliği satın alan kişi hesabını sildiğinde (7 günlük bekleme sonunda), partnerinin Premium hakları o anda sona erer.
• Aboneliği satın alan kişi partner ise, silme işleminden sonra da Premium onda kalır; yeni bir eşleşmede yeni partnerine de geçerli olur (abonelik süresi boyunca).
• Süresiz (ömür boyu) paketi satın alan kişi, kimden ayrılırsa ayrılsın ve kiminle eşleşirse eşleşsin süresiz Premium'a sahip olmaya devam eder.
• Abonelik mağaza hesabınıza (Apple Kimliği / Google hesabı) bağlıdır. Hesabınızı sildikten sonra aynı mağaza hesabıyla yeniden kayıt olup satın alımlarınızı geri yüklediğinizde, süresi devam eden Premium hakkınız yeniden görünür; ancak eski hesabınızdaki veriler geri gelmez.
• Tek kalan (eşleşmemiş) kullanıcı Premium satın alabilir; ancak yıldız sahiplenme yalnızca çiftlere özeldir.
• Tek kalan kullanıcı Premium'a sahip değilse yeni kayıt oluşturamaz (yalnızca gökyüzünü gezebilir ve eski verilerini okuyabilir)."

### 5.3 Bölüm 6 (Kış uykusu) → EKLE
**EKLE sonuna:** "Partnerinizin hesabını silmesi nedeniyle çift dağılırsa yıldız ve gezegenler kış uykusu/kasa süreci beklenmeden silinir; kasada saklanmaz."

### 5.4 Bölüm 7 (Arkadaş daveti) → KONTROL
"promosyonu" kelimesi geçiyor: uygulamadan promosyon kodu girişi kaldırıldı. Cümleyi "ücretli aboneliği ya da süresiz Premium'u olan çiftin..." olarak sadeleştir (promosyon kelimesini çıkar), ama sistemde promosyon kaynaklı Premium hâlâ olabilirse bırak.

---

## 6) MAĞAZA FORMLARI (web sitesi dışı ama aynı konu)
- Google Play → Veri güvenliği → "Veri silme": hareketsiz eşleşmemiş hesapların 30/60 gün sonra silindiğini ve hesap silmenin 7 gün sonra gerçekleştiğini belirt.
- Hesap silme web sayfası (Play zorunlu): yukarıdaki silme akışını (7 gün, iptal, partner, abonelik uyarısı) yaz.
- App Store → App Privacy: değişiklik yok, ancak "Diğer kullanım verileri: son kullanım zamanı" varsa ekle.

---

## ENGLISH VERSIONS

Use the same sections in the English pages.

**KVKK/GDPR §2 (security data):** "...unique device ID (UUID), last sign-in and **last app usage time**, security logs..."
**KVKK/GDPR §2 (couple data), ADD:** "When a relationship ends (for example when your partner deletes their account), the meeting and relationship dates are reset and entered again in a new pairing."
**§3 purposes, ADD:** "• Deleting unused, unpaired accounts after a set period (storage limitation) and sending a notice before deletion."
**§3 pairing purpose, NEW:** "• Linking two partners with a private pairing code and sharing the memory/calendar content saved after the pairing moment,"
**§7 first paragraph, NEW:** "You can request deletion of your account in Profile > Account Management & Danger Zone. The request waits 7 days; signing in with the same account during this period cancels the request automatically and you are informed. After 7 days **everything you created, uploaded or wrote** (profile details, photos, journals, letters, notes, special days, map pins, medicine and cycle records and content in your star) is permanently deleted from our servers. **Your partner's account is not deleted**; content your partner created remains available only to your partner. The shared star and the memory planets inside it are deleted regardless of who created them; automatically created anniversary entries are also deleted. Your partner's pairing code is renewed so your partner can pair again. Your partner is informed in the app and by notification about the request, reminders 3 days and 1 day before deletion, withdrawal and deletion. If both sides requested deletion, each account is deleted on its own 7th day; with the last account, everything remaining that belongs to the couple is permanently deleted. Backups are destroyed automatically within 30 days at the latest."
**§7 retention list, NEW:** "• Unused accounts: New accounts that never paired are deleted 30 days after last use; accounts left alone after a couple ended are deleted 60 days after last use. Accounts with an active subscription are not deleted; they are deleted 60 days after the subscription ends. Paired accounts are never deleted for this reason. A notification is sent about 7 days and 1 day before deletion (it may not reach you if notifications are off)."
**§7 retention list, NEW:** "• Earlier data and new partners: In a new pairing your new partner only sees data saved after the pairing moment; data from your earlier relationship is not shown to your new partner and stays only in your access (you can delete it any time)."
**§7 star line, ADD:** "If your partner deletes their account, the star and the memory planets inside it are deleted without waiting for the hibernation/vault period."

**Privacy §2 (content), NEW sentence:** "In a new pairing your partner only sees content saved after the pairing moment; content from an earlier relationship is not shown to your new partner."
**Privacy §2, ADD bullet:** "• Usage time: The last time your account was used. Kept only so unused, unpaired accounts can be deleted (Section 5)."
**Privacy §5, NEW first paragraph:** (same as the KVKK §7 English text above).
**Privacy §5, ADD:** "Unused accounts: ... (same as retention bullet)." and "Deleting your account does not cancel your Apple/Google subscription; cancel it separately in the store account."

**Terms §2, ADD:** "In a new pairing the partner only sees content saved after the pairing moment. When a couple's relationship ends (for example your partner deletes their account), the shared star and its planets are deleted and content you created stays in your account. A user left alone must pair again to use features that need a pairing (photos, letters, memories, meetups and star); a user left alone with Premium can use mood, journal, calendar notes, map notes and medicine/cycle tracking."
**Terms §7, ADD:** "Deleting unused accounts: accounts that never paired are deleted after 30 days of no use, accounts left alone after a couple ended after 60 days (except accounts with an active subscription, which are deleted 60 days after the subscription ends). A notice is sent before deletion. Paired accounts are not deleted for this reason."
**Terms §3, ADD:** "Deleting your account does not cancel your store subscription; you are responsible for cancelling it in the store."

**Consent §2 (couple data), NEW:** "...stored on encrypted servers to be shared only with my paired partner and only for content saved after the pairing moment; and, if my relationship ends, for my own data to remain hidden from my new partner,"

**Subscription §4, ADD last sentence:** "Deleting your account does not cancel your subscription; cancellation is made only in your store account."
**Subscription, NEW section "ACCOUNT DELETION, BREAKUP AND PREMIUM":**
"• If the person who bought the Premium subscription deletes their account (after the 7-day wait), the partner's Premium ends at that moment.
• If the partner is the one who bought the subscription, Premium stays with the partner after the deletion and also applies to a new partner during the subscription period.
• A person who bought the lifetime package keeps lifetime Premium no matter whom they part from or pair with.
• The subscription belongs to your store account (Apple ID / Google account). If you register again with the same store account after deleting your account and restore your purchases, the remaining Premium right becomes visible again; data from the old account does not come back.
• A user left alone can buy Premium, but claiming a star is only for couples.
• A user left alone without Premium cannot create new records (they can only browse the sky and read earlier data)."
**Subscription §6, ADD:** "If the couple breaks up because your partner deletes their account, the star and planets are deleted without waiting for hibernation/vault and are not stored in the vault."

---

## Not
Durum (2026-11-07): uygulama içi metinler (`src/constants/legalTexts.ts`) bu listeyle birebir güncellendi ve `docs/legal/*`
yeniden üretildi. Abonelik metnine yeni bölüm 6 eklendiği için eski 6 ve 7 numaralı bölümler 7 ve 8 oldu (iç atıflar da
güncellendi); sitede de aynı numaralandırmayı kullan. "Buluşma" da eşleşme isteyen özellikler listesine eklendi (uygulamada
da tek kalana kapalı). Sunucu tarafı canlıda; istemci değişiklikleri yeni build ile yayına çıkacak.

Bu metinler, `docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md` içindeki kararlara göre yazıldı. Opus uygulamadaki `legalTexts.ts` dosyasını da aynı şekilde güncelleyecek;
iki yerde metin birebir aynı olmalı. Uygulamayı App Store'a/Play'e göndermeden önce siteyi ve uygulama içi metinleri karşılaştır.
Hukuki dayanak ve yurt dışı aktarım gibi bölümler için avukat teyidi önerilir (önceki denetim raporunda da belirtilmişti).

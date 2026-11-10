# Zorunlu güncelleme kapısı: kullanım notu

Cihazdaki uygulama sürümü sunucudaki asgari sürümün **kesin olarak altındaysa** uygulamanın yerine kapatılamayan
"Yeni sürüm seni bekliyor" ekranı çıkar; tek düğme mağazaya götürür. Her belirsizlikte kapı **açık** kalır.

| Parça | Yer |
| :-- | :-- |
| Tablo + RPC | `supabase/migrations/20261111000000_app_version_gate.sql` (`app_version_requirements`, `get_app_version_requirement`) |
| SQL testi (yerel, ROLLBACK'li) | `supabase/tests/app_version_gate_test.sql` |
| Karar mantığı (saf, testli) | `src/lib/appVersionGate.ts` |
| Zamanlama + önbellek | `src/hooks/useAppVersionGate.ts` |
| Kapı + ekran | `src/components/common/AppVersionGate.tsx`, `ForceUpdateScreen.tsx` (kök `_layout.tsx` içinde) |

## Kapı ne zaman kapanır

Karşılaştırılan değer ikilinin kendi **görünen sürümüdür** (iOS `CFBundleShortVersionString`, Android `versionName`).
OTA bunu değiştirmez. Aynı görünen sürümün eski build'lerini ayırmak için isteğe bağlı `min_build` vardır
(iOS `CFBundleVersion`, Android `versionCode`). Bu alan **yalnızca cihazın sürümü `min_version`'a eşitse** uygulanır.

| Durum | Sonuç |
| :-- | :-- |
| Demo (misafir) modu | açık |
| Platform iOS/Android değil (web) | açık |
| Sunucuda satır yok / `min_version` boş (başlangıç) | açık |
| Sorgu hatası, ağ hatası, 8 sn zaman aşımı, bozuk yanıt; geçerli önbellek **yok** | açık |
| Sorgu başarısız; geçerli önbellek **var** (≤ 30 gün, aynı platform, bozuk değil) | önbelleğe göre karar |
| Cihaz sürümü okunamıyor / ayrıştırılamıyor | açık |
| Sunucudaki `min_version` ayrıştırılamıyor | açık (CHECK zaten engeller) |
| Cihaz sürümü > `min_version` | açık |
| Cihaz sürümü = `min_version`, `min_build` boş ya da cihaz build'i ≥ `min_build` ya da build okunamıyor | açık |
| Cihaz sürümü = `min_version` ve cihaz build'i < `min_build` | **kapalı** |
| Cihaz sürümü < `min_version` | **kapalı** |

Sorgu zamanı: açılışta, sonra uygulama öne geldikçe en sık 15 dakikada bir. Kapalıyken en sık 1 dakikada bir sorulur,
böylece geri alma çabuk yansır. Mağazadan güncelleme yapılınca uygulama zaten yeniden başlar.

## Önkoşul: migration canlıda olmalı

Uygulanmadan önce RPC olmadığı için istemci hata alır ve kapı açık kalır (zararsız). Uygulamak ayrı bir adımdır:

```bash
# 1) Yerel / geçici veritabanında dene (canlıda değil)
psql "$YEREL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261111000000_app_version_gate.sql
psql "$YEREL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/app_version_gate_test.sql   # "tüm kontroller geçti"
# 2) Canlıya (db push YASAK)
supabase db query --linked -f supabase/migrations/20261111000000_app_version_gate.sql
```

## Asgari sürümü yükseltmek (tek satır)

**Önce kontrol et:** eşik, incelemedeki sürümün üstünde olmamalı (inceleme gerçek hesapla yapılır, aşağıya bak).
Yeni sürüm o platformun mağazasında **herkese** açık olmalı. App Store'da onaylanıp yayınlanmış olmalı.
Google Play'de kademeli dağıtım **%100** olmalı: dağıtım dışındaki kullanıcı güncellemeyi bulamaz ve kilitli kalır.
Platformları ayrı ayrı yükselt.

```bash
supabase db query --linked "UPDATE public.app_version_requirements SET min_version = '1.1.0', updated_at = now() WHERE platform = 'ios';"
supabase db query --linked "UPDATE public.app_version_requirements SET min_version = '1.1.0', updated_at = now() WHERE platform = 'android';"
```

İsteğe bağlı alanlar:

- Aynı sürümün eski build'ini kapatmak için `min_build = 25` (yalnızca `min_version` doluyken; Android `versionCode`
  geçmişte sıfırlandı: 26 → 2…11. Build eşiğini yalnızca yeni bir görünen sürümle birlikte kullan).
- Ekran metni için `message_tr = '...'`, `message_en = '...'` (1-300 karakter). Boşsa uygulamanın kendi metni çıkar.
  Dilde metin yoksa öbür dile düşülmez, yerel metin gösterilir.
- Mağaza adresi `store_url`: yalnızca `https://apps.apple.com` / `itunes.apple.com` (iOS) ve `https://play.google.com`
  (Android) kabul edilir. Diğer adreslerde istemci kendi adresini kullanır.

Doğrulamak için giriş yapmamış bir istemcinin göreceğini sor:

```bash
curl -s "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/rpc/get_app_version_requirement" \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{"p_platform":"ios"}'
```

## Geri almak

```bash
supabase db query --linked "UPDATE public.app_version_requirements SET min_version = NULL, min_build = NULL, updated_at = now() WHERE platform IN ('ios', 'android');"
```

Açık uygulamalar en geç bir sonraki öne gelişte (15 dk aralık) yeni değeri görür. Kilitli uygulamalar soğuk açılışta
hemen, öne gelişte 1 dakika içinde açılır.

## Yanlışlıkla herkesi kilitlersek

1. **Hemen** yukarıdaki geri alma satırını çalıştır, sonra `curl` ile `min_version: null` döndüğünü doğrula.
2. Kullanıcılara: uygulamayı **internete bağlıyken** kapatıp açmaları yeterli. Kilitli ekran kendini 1 dakikada bir yeniler.
3. **Fonksiyonu ya da tabloyu silme.** Silmek kilidi açmaz: sorgu hata verir, istemci son başarılı yanıta (kilitli önbellek)
   düşer ve 30 gün kilitli kalır. Kilidi açan şey sunucunun geçerli bir "koşul yok" (`min_version = NULL`) yanıtıdır.
4. Sunucuya hiç ulaşamayan cihaz (çevrimdışı) en fazla 30 gün kilitli kalabilir, sonra önbellek geçersiz sayılır.
   Böyle bir cihaz zaten veritabanına da erişemez.
5. Yanlış değer **CHECK** kısıtlarına takılmadıysa ama istemcide beklenmedik bir şey oluyorsa son çare: aynı satırı
   `NULL` yap. İstemci bozuk/boş değerde her zaman açar.

## Demo modu ve mağaza incelemesi

Uygulama içi misafir demo modunda (`isDemoMode`) kapı uygulanmaz. Gerekçe: demo uygulamaya gömülü örnek veriyle çalışır.
Oturum belirteci sahtedir (`demo_guest_token`), gerçek bir hesabın verisine erişemez. Yazma eylemleri `useDemoAction` ile
durdurulur. Kapının korumak istediği şey (eski istemcinin canlı veriye dokunması) demoda yoktur. Uygulamayı bir kez açıp
"göz atmak" isteyen eski sürüm kullanıcısını da kilitlemeye gerek yoktur.

**Mağaza incelemesi demo moduyla değil, gerçek bir hesapla yapılır** (App Review'a verilen `demo@couplesky.app` /
`partner@couplesky.app`, canlıdaki çift 165). Kapı bu hesaba **uygulanır**. Bu yüzden kural şudur: `min_version`'ı
**incelemedeki sürümün üstüne asla çıkarma.** İnceleyen her zaman yeni build'i kullanır, eşik o sürüme eşit ya da
altındaysa inceleme takılmaz.

Kötüye kullanım: kilitli ekranda demoya geçiş düğmesi yoktur. Demoya ancak kilit gelmeden önce girilmiş olabilir.
Demodan çıkınca giriş ekranına dönülür ve kapı yeniden uygulanır. Demoda kalan kullanıcı yalnızca örnek veriyi görür,
gerçek hesabına erişemez. Bu yüzden istisna bir atlatma yolu değildir.

## OTA ve sürüm (1.0.0 → 1.1.0)

- `runtimeVersion.policy = appVersion`. Mağazadaki/incelemedeki build'lerin runtime'ı `1.0.0`, kanalı `production`
  (iOS build 15/17/18, Android versionCode 9/11; EAS'tan 2026-11-11'de okundu). Şimdiye kadar hiç OTA yayınlanmadı.
- Kapı yalnızca JS'dir. Kullandığı native modüllerin (`expo-application`, AsyncStorage, `expo-linear-gradient`,
  `expo-status-bar`, RN `Linking`/`AppState`) hepsi 1.0.0 ikilisinde (commit `80ce032a`) vardır. O build'lerin parmak izi
  ile bugünkü kodunki arasındaki tek fark `.gitignore` (native değil; `eas fingerprint:compare` ile bakıldı).
- **1.0.0'a ulaştırmak için** `app.json` sürümü hâlâ `1.0.0` iken `production` kanalına OTA yayınlamak gerekir. O OTA dalın
  bütün JS'ini taşır (ortak liste kapalı bayrakla, gece gökyüzü vb.). Bu ayrı bir karardır. `checkAutomatically: ON_LOAD` +
  `fallbackToCacheTimeout: 0` olduğu için güncelleme ilk açılışta arka planda iner ve **bir sonraki** soğuk açılışta devreye girer.
- `app.json` → `1.1.0` yapılınca runtime `1.1.0` olur. O koddan yayınlanan OTA'lar 1.0.0 ikililerine **ulaşmaz**, yalnızca
  1.1.0 build'lerine gider. 1.0.0'a sonradan OTA göndermek için sürümü 1.0.0 olan bir commit'ten yayınlamak gerekir.
- OTA'sız 1.0.0 ikilisinde kapı yoktur. O kullanıcılar `min_version` yükseltilse bile kilitlenmez. Kapı onları ancak
  OTA almışlarsa durdurabilir.

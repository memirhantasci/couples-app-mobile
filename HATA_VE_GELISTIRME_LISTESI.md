# 🛠️ Couples App Mobile — Hata, Konsol Logları ve UX Düzeltme Listesi

> **Not:** Bu belge, kullanıcının ilettiği konsol logları, ekran görüntüleri ve kullanıcı deneyimi (UX) geri bildirimleri taranarak hiçbir kaynak koda dokunulmadan hazırlanmıştır. Daha sonra adım adım düzeltilmek üzere tüm kök nedenler, ilgili dosya konumları ve hazır çözüm reçeteleri eksiksiz listelenmiştir.

---

## 📑 Hızlı Genel Bakış & Görev Takip Tablosu

| # | Hata / Bildirim Konusu | Tür | Platform | İlgili Dosya(lar) | Öncelik |
|---|---|---|---|---|---|
| 1 | **Native Crypto Hatası** (`Native crypto module could not be used...`) | Runtime Error | iOS & Android | [`src/utils/crypto.ts`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/utils/crypto.ts) | 🔴 Kritik |
| 2 | **Mektup Kaydetme PGRST203 Hatası** (`Could not choose best candidate function...`) | DB / RPC Error | Tüm | Supabase DB / [`letters.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/letters.tsx) | 🔴 Kritik |
| 3 | **Expo Notifications Trigger Hatası** (`Invalid trigger object... needs type/channelId`) | Runtime Error | Android & iOS | [`src/lib/notifications.ts`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/lib/notifications.ts) | 🔴 Kritik |
| 4 | **Buluşma Kartı Eski Buluşmayı Gösterme Hatası** (Yeni buluşma varken eskinin kalması) | Mantıksal / Cache | Tüm | [`home.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/home.tsx), [`meetings.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/meetings.tsx) | 🟠 Yüksek |
| 5 | **iOS Harita Renk Modunun Değişmemesi** (Apple Maps vs Google Maps Custom Style) | Platform / UX | Yalnızca iOS | [`src/app/(tabs)/map.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/map.tsx) | 🟠 Yüksek |
| 6 | **MoodSelector AsyncStorage Null Hatası** (`Native module is null... legacy storage`) | Runtime Error | iOS & Expo Go | [`src/components/home/MoodSelector.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/components/home/MoodSelector.tsx) | 🔴 Kritik |
| 7 | **Mektup Mühürlemede Tarih Seçicinin İngilizce Olması** (`November 2026`) | Yerelleştirme / i18n | Yalnızca iOS | [`src/app/(tabs)/letters.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/letters.tsx) | 🟡 Orta |
| 8 | **Fotoğraflı Anı Kaydında Desteklenmeyen MIME Türü** (`mime type image/jpg is not supported`) | Storage Error | Tüm | [`src/app/(tabs)/add-memory.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/add-memory.tsx) | 🔴 Kritik |
| 9 | **Günlük Notu Duplicate Key Hatası** (`daily_notes_user_id_date_key - Error 23505`) | DB Constraint | Tüm | [`src/app/(tabs)/add-daily-note.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/add-daily-note.tsx) | 🔴 Kritik |
| 10 | **İlaç Ekranında Tarih/Saat Seçicisinin Sol Altta Küçük Açılması** (iOS Compact Picker) | UI / UX Kusuru | Yalnızca iOS | [`MedicineManagerModal.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/components/medicine/MedicineManagerModal.tsx) | 🟠 Yüksek |
| 11 | **Kozmik Yıldız Haritası Sesinin Kötü Olması ve iOS'ta Çalmaması** | Audio / Garbage Col. | iOS vs Android | [`src/lib/soundEffects.ts`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/lib/soundEffects.ts), [`MacroSkyCanvas.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/modules/stars/canvas/MacroSkyCanvas.tsx) | 🟠 Yüksek |

---

## 🔍 DETAYLI HATA ANALİZLERİ VE ÇÖZÜM REÇETELERİ

---

### 1. Native Crypto Güvenli Rastgele Sayı Hatası

- **Hata Mesajı:**
  ```text
  Encryption error: Error: Native crypto module could not be used to get secure random number.
  Call Stack:
  encryptWithKey (src/utils/crypto.ts:54, 63)
  encrypt (src/utils/crypto.ts:38)
  handleSave (src/app/(tabs)/add-daily-note.tsx:63)
  ```
- **Etkilenen Dosya:**
  - [`src/utils/crypto.ts`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/utils/crypto.ts#L51-L66)
- **Kök Neden:**
  - `crypto.ts` satır 54'te dinamik IV oluşturmak için `CryptoJS.lib.WordArray.random(16)` fonksiyonu çağrılıyor.
  - React Native / Hermes motorunda global `window.crypto.getRandomValues` veya Node.js `crypto` çekirdek modülü native olarak bulunmaz. Bu nedenle `crypto-js` kütüphanesi güvenli rastgele sayı üretemeyerek istisna (exception) fırlatıyor.
  - Hata yakalandığında `logger.error` tetiklenip veri şifrelenmeden düz metin olarak dönüyor veya form kaydını bozuyor.
- **Çözüm Reçetesi:**
  - Projede zaten kurulu olan `expo-crypto` modülü üzerinden rastgele byte dizisi üretilip `CryptoJS.lib.WordArray` formatına dönüştürülmelidir:
  ```typescript
  import * as ExpoCrypto from 'expo-crypto';

  function getRandomBytesWordArray(byteCount: number) {
    const bytes = ExpoCrypto.getRandomBytes(byteCount);
    const words: number[] = [];
    for (let i = 0; i < byteCount; i += 4) {
      words.push(
        ((bytes[i] || 0) << 24) |
        ((bytes[i + 1] || 0) << 16) |
        ((bytes[i + 2] || 0) << 8) |
        (bytes[i + 3] || 0)
      );
    }
    return CryptoJS.lib.WordArray.create(words, byteCount);
  }

  // encryptWithKey içinde:
  // const iv = CryptoJS.lib.WordArray.random(16); yerine:
  const iv = getRandomBytesWordArray(16);
  ```

---

### 2. Mektup Kaydetme PGRST203 Fonksiyon Çakışması (PostgreSQL / Supabase)

- **Hata Mesajı:**
  ```text
  Letter save error: {"code":"PGRST203","details":null,"hint":"Try renaming the parameters or the function itself in the database so function overloading can be resolved","message":"Could not choose the best candidate function between: public.save_letter(p_receiver_id => uuid, p_ti...(truncated)..."}
  ```
- **Etkilenen Dosyalar:**
  - [`src/app/(tabs)/letters.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/letters.tsx#L262-L268)
  - Supabase Veritabanı Migrasyonları: [`003_supabase_auth_refactor.sql`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/supabase/migrations/003_supabase_auth_refactor.sql#L133) ve [`023_premium_and_security_tightening.sql`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/supabase/migrations/023_premium_and_security_tightening.sql#L169)
- **Kök Neden:**
  - Supabase PostgreSQL veritabanında `save_letter` adında daha önceden tanımlanmış birden fazla versiyon (function overloading) bulunmaktadır (örneğin parametrelerden biri `DATE` iken diğerinde `TEXT` veya `TIMESTAMPTZ` kalmış olabilir).
  - PostgREST JSON RPC çağrısı aldığında veri tipleri örtüşen birden fazla fonksiyon görünce hangisini seçeceğini bilemeyip `PGRST203` hatasıyla işlemi iptal etmektedir.
- **Çözüm Reçetesi:**
  - Supabase Dashboard -> SQL Editor açılarak eski `save_letter` tanımları tamamen kaldırılıp tekil, güncel versiyon tanımlanmalıdır:
  ```sql
  -- Eski tüm save_letter varyantlarını temizle
  DROP FUNCTION IF EXISTS public.save_letter(uuid, text, text, date, integer);
  DROP FUNCTION IF EXISTS public.save_letter(uuid, text, text, text, integer);
  DROP FUNCTION IF EXISTS public.save_letter(uuid, text, text, timestamp, integer);
  DROP FUNCTION IF EXISTS public.save_letter(uuid, text, text, timestamptz, integer);

  -- Tek ve kesin fonksiyonu yeniden oluştur (023 nolu migrasyondaki güvenli haliyle)
  CREATE OR REPLACE FUNCTION public.save_letter(
    p_receiver_id UUID,
    p_title TEXT,
    p_content TEXT,
    p_unlock_date DATE,
    p_couple_id INTEGER
  )
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
  DECLARE
    v_caller_couple_id INTEGER;
    v_user_id UUID;
    v_token_balance INTEGER;
    v_is_premium BOOLEAN;
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    -- İlişki ve yetki kontrolü
    SELECT couple_id, is_premium INTO v_caller_couple_id, v_is_premium
    FROM public.users WHERE id = v_user_id;

    IF v_caller_couple_id IS NULL OR v_caller_couple_id != p_couple_id THEN
      RAISE EXCEPTION 'Unauthorized couple operation' USING ERRCODE = '42501';
    END IF;

    -- Mektup kaydı
    INSERT INTO public.letters (sender_id, receiver_id, title, content, unlock_date, couple_id)
    VALUES (v_user_id, p_receiver_id, p_title, p_content, p_unlock_date, p_couple_id);
  END;
  $$;

  GRANT EXECUTE ON FUNCTION public.save_letter(UUID, TEXT, TEXT, DATE, INTEGER) TO authenticated;
  ```

---

### 3. Expo Notifications Trigger API Uyumsuzluğu

- **Hata Mesajı:**
  ```text
  [LocalPush] Failed to schedule date notification: TypeError: The `trigger` object you provided is invalid. It needs to contain a `type` or `channelId` entry. Refer to the documentation to update your code: https://docs.expo.dev/versions/latest/sdk/notifications/#notificationtriggerinput
  [LocalPush] Failed to schedule daily notification: TypeError: The `trigger` object you provided is invalid. It needs to contain a `type` or `channelId` entry.
  ```
- **Etkilenen Dosyalar:**
  - [`src/lib/notifications.ts`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/lib/notifications.ts#L409-L443) (`scheduleDailyLocalNotification` ve `scheduleDateLocalNotification`)
- **Kök Neden:**
  - Modern Expo SDK (`v52` ve `v57`): `expo-notifications` kütüphanesinde `Notifications.scheduleNotificationAsync` trigger şeması tamamen yenilendi.
  - Eski kodda günlük bildirim için `{ hour, minute, repeats: true }` ve tarih bildirimi için doğrudan `trigger: triggerDate as any` geçiliyordu.
  - Güncel Expo Notifications, trigger nesnesi içinde zorunlu olarak `type` alanı (ör. `SchedulableTriggerInputTypes.CALENDAR`, `SchedulableTriggerInputTypes.DATE`) ve Android bildirim kanalı (`channelId`) talep ediyor.
- **Çözüm Reçetesi:**
  - [`src/lib/notifications.ts`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/lib/notifications.ts) içinde trigger tanımları Expo'nun yeni tip formatına çevrilmelidir:
  ```typescript
  import * as Notifications from "expo-notifications";
  import { SchedulableTriggerInputTypes } from "expo-notifications";

  // Günlük bildirim (İlaç vb.):
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: cleanTitle,
      body: cleanBody,
      sound: true,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
      channelId: "default",
    },
  });

  // Tarih bildirimi (Regl yaklaşma, özel gün vb.):
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: cleanTitle,
      body: cleanBody,
      sound: true,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: "default",
    },
  });
  ```

---

### 4. Ana Sayfada Gerçekleşen Buluşmanın Takılı Kalması & Yeni Buluşmanın Görünmemesi

- **Kullanıcı Geri Bildirimi:**
  > *"Bir buluşma gerçekleşti süresi geçti yeni bulusma planlandı hala anasayfada buluşma gerçekleşti gözüküyor yeni bulusma varsa gerçekleşen buluşmayı göstermeme gerek yok"*
- **Etkilenen Dosyalar:**
  - [`src/app/(tabs)/home.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/home.tsx#L153-L163)
  - [`src/components/home/MeetingCountdown.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/components/home/MeetingCountdown.tsx#L51-L72)
  - [`src/app/(tabs)/meetings.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/meetings.tsx)
- **Kök Neden:**
  1. **Eksik Query Invalidation:** `meetings.tsx` ekranında yeni bir buluşma eklendiğinde `home_dashboard` anahtarını taşıyan React Query önbelleği (`["home_dashboard"]`) yenilenmiyor. Ana sayfa 5 dakika boyunca önbellekteki eski buluşmayı tutuyor.
  2. **Buluşma Seçim Mantığı Kusuru:** `home.tsx` içinde `activeMeeting` belirlenirken `futureMeeting || meetingRes.data[meetingRes.data.length - 1]` denilerek geçmiş buluşma fallback olarak seçiliyor. Ayrıca `MeetingCountdown.tsx` bileşeni süresi geçen buluşmayı *"Buluşma gerçekleşti!"* mesajıyla ekranda tutuyor.
- **Çözüm Reçetesi:**
  1. `meetings.tsx` içinde buluşma kaydı ve güncellemesi yapıldığında `queryClient.invalidateQueries({ queryKey: ["home_dashboard"] })` çağrılmalıdır.
  2. `home.tsx` içinde buluşma filtreleme mantığı güncellenmeli:
     - Gelecekte planlanmış bir buluşma (`futureMeeting`) varsa, geçmişteki hiçbir buluşma dikkate alınmamalı ve doğrudan bu gelecek buluşma seçilmelidir.
     - Eğer gelecekte hiç buluşma yoksa; geçmiş buluşma yalnızca son 30-60 dakika içerisinde gerçekleşmişse tebrik olarak gösterilmeli, daha eskiyse ana sayfadaki buluşma kartı hiç render edilmemelidir (`activeMeeting = null`).

---

### 5. iOS Haritada Renk / Tema Modunun Değişmemesi

- **Kullanıcı Geri Bildirimi:**
  > *"İosta haritada renk modu değişmiyor haritada dediğim fotoğraf not olan harita"*
- **Etkilenen Dosyalar:**
  - [`src/app/(tabs)/map.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/map.tsx#L309-L318)
  - [`src/constants/mapStyles.ts`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/constants/mapStyles.ts)
- **Kök Neden:**
  - `map.tsx` satır 312'de `<MapView customMapStyle={MAP_THEME_STYLES[mapTheme]} ... />` tanımlıdır.
  - `react-native-maps` kütüphanesinde `customMapStyle` özelliği **yalnızca Google Maps (`provider={PROVIDER_GOOGLE}`)** tarafından tanınır.
  - iOS işletim sisteminde harita varsayılan olarak **Apple Maps (MapKit)** motorunu çalıştırır. Apple Maps JSON tabanlı Google Maps stil dizilerini tamamen yok sayar. Bu nedenle tema çipinde "Gece", "Romantik", "Açık" vb. seçilse bile harita renk paletini değiştirmez.
- **Çözüm Reçetesi:**
  - iOS'ta Apple Maps'in native koyu ve açık mod desteği `userInterfaceStyle` prop'u üzerinden kontrol edilmelidir:
  ```tsx
  <MapView
    ref={mapRef}
    style={StyleSheet.absoluteFill}
    customMapStyle={Platform.OS === "android" ? MAP_THEME_STYLES[mapTheme] : undefined}
    userInterfaceStyle={isLight ? "light" : "dark"}
    // ...
  >
  ```
  *(Alternatif olarak iOS'ta Google Maps SDK Pod kurulumu yapılarak `provider={PROVIDER_GOOGLE}` verilebilir).*

---

### 6. MoodSelector AsyncStorage "Native module is null" Hatası

- **Hata Mesajı:**
  ```text
  Rate limit state load error: AsyncStorageError: Native module is null, cannot access legacy storage
  Source: src/components/home/MoodSelector.tsx:81
  ```
- **Etkilenen Dosya:**
  - [`src/components/home/MoodSelector.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/components/home/MoodSelector.tsx#L11)
- **Kök Neden:**
  - Projede Expo Go / iOS uyumsuzluklarını önlemek için [`src/lib/safeStorage.ts`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/lib/safeStorage.ts) geliştirilmiş ve tüm sayfalarda kullanılmıştır.
  - Ancak `MoodSelector.tsx` dosyasında satır 11'de unutularak doğrudan ham paket import edilmiştir:
    ```typescript
    import AsyncStorage from "@react-native-async-storage/async-storage";
    ```
  - iOS Expo Go ortamında bu ham modül `null` olduğu için rate-limit kontrolü esnasında hata basmaktadır.
- **Çözüm Reçetesi:**
  - `src/components/home/MoodSelector.tsx` satır 11'deki import güvenli sarmalayıcıya yönlendirilmelidir:
    ```typescript
    // ESKİ:
    // import AsyncStorage from "@react-native-async-storage/async-storage";

    // YENİ:
    import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
    ```

---

### 7. Mektup Mühürleme Tarih Çarkının İngilizce Olması

- **Kullanıcı Geri Bildirimi & Ekran Görüntüsü 1:**
  > *"Mektupda tarih ingilizce"* (Ekran görüntüsünde: Üstteki başlık "28 Kasım 2026, Cumartesi" Türkçe iken alttaki tarih çarkında `November 2026`, `August`, `September`, `October` yazıyor).
- **Etkilenen Dosya:**
  - [`src/app/(tabs)/letters.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/letters.tsx#L766-L777)
- **Kök Neden:**
  - `@react-native-community/datetimepicker` bileşenine iOS ortamında açıkça `locale` prop'u tanımlanmadığında cihazın/simülatörün varsayılan işletim sistemi bölge ayarını kullanır ve ay adlarını İngilizce basar.
- **Çözüm Reçetesi:**
  - `letters.tsx` içindeki `DateTimePicker` tanımına `locale="tr-TR"` prop'u eklenmelidir:
  ```tsx
  <DateTimePicker
    value={new Date(unlockDate)}
    mode="date"
    display={Platform.OS === "ios" ? "spinner" : "default"}
    minimumDate={new Date()}
    locale="tr-TR"
    onChange={(_, selectedDate) => {
      setShowDatePicker(Platform.OS === "ios");
      if (selectedDate) {
        setUnlockDate(dayjs(selectedDate).format("YYYY-MM-DD"));
      }
    }}
  />
  ```

---

### 8. Fotoğraflı Anı Kaydetmede Desteklenmeyen MIME Türü (`image/jpg`)

- **Hata Mesajı:**
  ```text
  Memory save error: StorageApiError: mime type image/jpg is not supported
  Source: src/app/(tabs)/add-memory.tsx:180
  ```
- **Etkilenen Dosya:**
  - [`src/app/(tabs)/add-memory.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/add-memory.tsx#L124-L132)
- **Kök Neden:**
  - Satır 124'te: `const fileExt = localImage.uri.split('.').pop() || 'jpg';`
  - Satır 131'de: `contentType: \`image/${fileExt}\``
  - Seçilen fotoğraf `.jpg` uzantılı olduğunda `image/jpg` MIME türü gönderilmektedir. Ancak IANA / Supabase Storage standartlarında geçerli JPEG MIME türü kesin olarak `image/jpeg`'dir. Supabase API `image/jpg` değerini geçersiz kabul ederek reddetmektedir.
- **Çözüm Reçetesi:**
  - MIME türü belirlenirken `jpg` uzantısı `jpeg` olarak normalize edilmelidir:
  ```typescript
  const rawExt = (localImage.uri.split('.').pop() || 'jpg').toLowerCase();
  const fileExt = rawExt === 'jpg' ? 'jpeg' : rawExt;
  const contentType = `image/${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("memories")
    .upload(filePath, decode(localImage.base64), {
      contentType: contentType,
    });
  ```

---

### 9. Günlük Notu Duplicate Key Hatası (Error 23505)

- **Hata Mesajı:**
  ```text
  {"code":"23505","details":null,"hint":null,"message":"duplicate key value violates unique constraint \"daily_notes_user_id_date_key\""}
  Source: src/app/(tabs)/add-daily-note.tsx:77
  ```
- **Etkilenen Dosya:**
  - [`src/app/(tabs)/add-daily-note.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/app/(tabs)/add-daily-note.tsx#L65-L70)
- **Kök Neden:**
  - Veritabanındaki `daily_notes` tablosunda her kullanıcı için gün başına yalnızca 1 kayıt açılmasına izin veren `daily_notes_user_id_date_key` benzersiz kısıtı (unique constraint) bulunmaktadır.
  - Kullanıcı aynı gün içerisinde günlüğünü güncellemek veya tekrar not yazmak istediğinde kod doğrudan `.insert(...)` çalıştırmakta ve duplicate key hatasıyla çökmektedir.
- **Çözüm Reçetesi:**
  - `insert` yerine `upsert` kullanılmalı ve çakışma sütunları belirtilmelidir:
  ```typescript
  const { error } = await supabase.from("daily_notes").upsert(
    {
      user_id: session.user.id,
      date: dayjs().format("YYYY-MM-DD"),
      content: encrypted,
    },
    { onConflict: "user_id,date" }
  );
  ```

---

### 10. İlaç Yönetim Ekranında Tarih ve Saatin Sol Altta Küçük Açılması (iOS Picker UX)

- **Kullanıcı Geri Bildirimi & Ekran Görüntüsü 2:**
  > *"İlaçda tarih saat kaydederken sol alttaki yere tıklayınca değiştirebiliyosun iphone cihazda direk tarihe ve saate tıklandığında değiştirilmesi laızm"* (Ekran görüntüsünde: Modalın en sol altında serbest yüzen gri bir `[ 14:00 ]` hapı görünmektedir).
- **Etkilenen Dosya:**
  - [`src/components/medicine/MedicineManagerModal.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/components/medicine/MedicineManagerModal.tsx#L400-L445)
- **Kök Neden:**
  - iOS 14+ üzerinde `DateTimePicker` bileşeni `display="default"` ile çağrıldığında sistem bunu inline kompakt buton (`UIDatePickerStyleCompact`) olarak render eder.
  - Bu bileşen JSX ağacında modalın en altına (satır 400+) yerleştirildiği için, ekranda bağımsız, sol alt köşeye yapışık gri bir baloncuk olarak belirmektedir. Kullanıcı formdaki "09:00" veya "18.10.2026" butonuna bastığında hiçbir picker açılmamakta; sol altta beliren o küçük yabancı butona basmak zorunda kalmaktadır.
- **Çözüm Reçetesi:**
  - İki temiz çözümden biri tercih edilmelidir:
    - **Yöntem 1 (Önerilen - Temiz Modal Çarkı):** iOS için `display="spinner"` kullanılıp, picker açıldığında şık bir alt sayfa (ActionSheet modalı) içerisinde "Vazgeç" ve "Seç" butonlarıyla birlikte sunulması.
    - **Yöntem 2 (Native Compact Overlay):** Eğer native kompakt picker korunmak isteniyorsa, `DateTimePicker` doğrudan formdaki ilgili butonun (`timePickerBox` / `datePickerBtn`) içerisine `position: 'absolute'`, `opacity: 0.02` ile giydirilmeli; böylece kullanıcı direkt saate dokunduğunda native iOS popover'ı butonun üzerinden açılmalıdır.

---

### 11. Kozmik Yıldız Haritası Sesinin Kötü Olması ve iOS'ta Hiç Çalmaması

- **Kullanıcı Geri Bildirimi:**
  > *"Yıldız kısmındaki sesin değişmesimlaızm kötü yıldıza dokununca gelen ses de kötü yıldıza dokununca androidden ses geliyor iostan ses gelmiyor"*
- **Etkilenen Dosyalar:**
  - [`src/lib/soundEffects.ts`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/lib/soundEffects.ts#L306-L317) (`playCelestialChime`)
  - [`src/modules/stars/canvas/MacroSkyCanvas.tsx`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/src/modules/stars/canvas/MacroSkyCanvas.tsx#L346)
  - Ses Dosyası: [`assets/sounds/celestial_chime.wav`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/assets/sounds/celestial_chime.wav)
- **Kök Neden:**
  1. **iOS'ta Sesin Çıkmaması (Garbage Collection & Silent Mode):**
     - `soundEffects.ts` satır 312'de:
       ```typescript
       const player = createAudioPlayer(CELESTIAL_CHIME_ASSET);
       player.play();
       ```
     - Burada `player` nesnesi fonksiyon içerisinde yerel (local) bir değişken olarak yaratılmaktadır. `playSoundEffect` fonksiyonundaki gibi bir `playerPool` singleton havuzuna kaydedilmemektedir.
     - iOS JavaScript motorunda (Hermes) yerel değişken fonksiyon biter bitmez Garbage Collector (çöp toplayıcı) tarafından bellekten temizlenir ve native `AVPlayer` daha ses çalmaya fırsat bulamadan yok edilir. Android'de ise çöp toplayıcı daha toleranslı olduğu için ses çalabilmektedir.
     - Ayrıca iOS donanımsal sessiz anahtarı (mute switch) açıkken sesin duyulabilmesi için `setAudioModeAsync({ playsInSilentMode: true })` yapılandırmasının önceden tamamlanmış olması şarttır.
  2. **Ses Tınısının Beğenilmemesi / Kötü Olması:**
     - Şu anki `celestial_chime.wav` dosyası 211 KB boyutunda, kullanıcının kulağına rahatsız edici/kaba gelen bir tınıya sahiptir.
- **Çözüm Reçetesi:**
  1. `playCelestialChime` fonksiyonu singleton player havuzuna (`playerPool`) dahil edilmeli veya modül seviyesinde kalıcı bir `AudioPlayer` referansı üzerinden `seekTo(0)` ve `play()` çalıştırılmalıdır:
     ```typescript
     let celestialChimePlayer: AudioPlayer | null = null;

     export async function playCelestialChime(): Promise<void> {
       if (Platform.OS === 'web') return;
       const enabled = await getSoundEffectsEnabled();
       if (!enabled) return;
       try {
         await ensureAudioMode();
         if (!celestialChimePlayer) {
           celestialChimePlayer = createAudioPlayer(CELESTIAL_CHIME_ASSET);
         }
         try {
           celestialChimePlayer.seekTo(0);
         } catch {}
         celestialChimePlayer.play();
       } catch (err) {
         logger.log('[SoundEffects] Celestial chime notice:', err);
       }
     }
     ```
  2. `assets/sounds/celestial_chime.wav` dosyası; daha zarif, soft, hafif yankılı bir sihirli yıldız parıltısı (magic sparkle / harp chime) ses efektiyle güncellenmelidir.

---

## 📌 Sonraki Adım İçin Uygulama Sırası Önerisi

Tüm bu maddeleri düzeltmeye başlamak istediğinizde şu sırayla gitmek en pratik sonucu verecektir:

1. **Önce Veritabanı (1 Dakika):** Supabase SQL Editor'da `save_letter` temizliği (Madde 2).
2. **Kritik Storage & Form Hataları (3 Dakika):** `add-memory.tsx` MIME düzeltmesi (Madde 8), `add-daily-note.tsx` upsert (Madde 9), `crypto.ts` ExpoCrypto entegrasyonu (Madde 1).
3. **Sistem Altyapısı (2 Dakika):** `notifications.ts` yeni Expo trigger tipleri (Madde 3), `MoodSelector.tsx` safeStorage importu (Madde 6).
4. **Kullanıcı Deneyimi & Platform (5 Dakika):** `home.tsx` buluşma kartı (Madde 4), `map.tsx` iOS dark/light modu (Madde 5), `letters.tsx` Türkçe takvim (Madde 7), `MedicineManagerModal.tsx` iOS picker UX (Madde 10), `soundEffects.ts` iOS ses çalma ve yeni yıldız tınısı (Madde 11).

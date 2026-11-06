-- ==============================================================================
-- TURKISH DATA RESTORATION WITH 2 OPPOSITE TURKEY PHOTOS FOR COUPLE ID 132
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_couple_id INT := 132;
  v_user_male UUID := '7ddd0c70-cd45-4236-93cd-bd5925a38b54'::uuid;
  v_user_female UUID := 'b9be438f-7b12-49f5-9237-f3e40f223c70'::uuid;
  v_med1_id INT;
  v_med2_id INT;
  v_med3_id INT;
  v_med4_id INT;
BEGIN

  -- 1. Users: Türkçe İsimler
  UPDATE public.users 
  SET display_name = 'Emirhan', username = 'emirhan'
  WHERE id = v_user_male;

  UPDATE public.users 
  SET display_name = 'Sevgilim ❤️', username = 'sevgilim'
  WHERE id = v_user_female;

  -- 2. Star: Türkçe Özel İsim & Baş Harfler
  UPDATE public.couple_stars
  SET custom_name = 'Bizim Yıldızımız ✨', owner_initials = 'E 💕 S'
  WHERE couple_id = v_couple_id;

  -- 3. Mektuplar: Duygusal Türkçe Mektuplar
  DELETE FROM public.letters WHERE couple_id = v_couple_id;

  INSERT INTO public.letters (sender_id, receiver_id, title, content, unlock_date, couple_id, hidden_by_sender, hidden_by_receiver)
  VALUES 
    (
      v_user_male, 
      v_user_female, 
      'Seni İlk Gördüğüm Gün ✨', 
      'Gözlerinin gözlerime değdiği o ilk saniyeyi hâlâ dün gibi hatırlıyorum. Sanki koca evren bir anlığına durmuş, sadece bizim için nefes alıyordu. O günden beri hayatıma kattığın her ışık, her tebessüm için teşekkür ederim. Seni her şeyden çok seviyorum.', 
      '2026-10-15', 
      v_couple_id, 
      false, 
      false
    ),
    (
      v_user_female, 
      v_user_male, 
      'Hayatımdaki En Güzel İyikim 🤍', 
      'Birlikte geçen koskoca bir yıl... Kahkahalarımız, sabah kahvelerimiz, sessizce birbirimize sarıldığımız o huzurlu anlar. Yanındayken dünyanın tüm gürültüsü diniyor. Sen benim hem en yakın arkadaşım, hem sığınağım, hem de kalbimin tek sahibisin. İyi ki varsın bir tanem.', 
      '2026-10-30', 
      v_couple_id, 
      false, 
      false
    ),
    (
      v_user_male, 
      v_user_female, 
      'Gelecekteki Bize 🌙', 
      'Bu mektubu açtığında yan yana bir mevsimi daha geride bırakmış olacağız. Hayat ne kadar hızlı akarsa aksın, kalbimin her atışında sana olan sevgimin katlanarak büyüyeceğini bilmeni istedim. Sevgililer Günümüz kutlu olsun sevgilim.', 
      '2027-02-14', 
      v_couple_id, 
      false, 
      false
    ),
    (
      v_user_female, 
      v_user_male, 
      'Küçük Bir Sürpriz 🎁', 
      'Yeni yıla girerken sana ufak bir hatıra bırakmak istedim. Birlikte çıktığımız tüm bu güzel yollar gibi, önümüzdeki yıl da aşkımızın en güzel yılı olsun. Seni sonsuza dek seveceğim.', 
      '2026-12-25', 
      v_couple_id, 
      false, 
      false
    );

  -- 4. İlaçlar: Türkçe Takviyeler & Geçmiş Kayıtları
  DELETE FROM public.medicine_logs WHERE couple_id = v_couple_id;
  DELETE FROM public.medicines WHERE couple_id = v_couple_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_male, 'D Vitamini (2000 IU)', '09:00:00', ARRAY['09:00'], '2026-10-01', '2027-10-01', true)
  RETURNING id INTO v_med1_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_male, 'Omega 3 Balık Yağı', '13:00:00', ARRAY['13:00'], '2026-10-01', '2027-10-01', true)
  RETURNING id INTO v_med2_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_female, 'Günlük Multivitamin', '09:30:00', ARRAY['09:30'], '2026-10-01', '2027-10-01', true)
  RETURNING id INTO v_med3_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_female, 'Magnezyum Kompleks', '21:30:00', ARRAY['21:30'], '2026-10-01', '2027-10-01', true)
  RETURNING id INTO v_med4_id;

  INSERT INTO public.medicine_logs (couple_id, user_id, medicine_id, date, status, time, taken_at)
  VALUES
    (v_couple_id, v_user_male, v_med1_id, '2026-11-05', 'DRANK', '09:00', '2026-11-05 09:05:00+03'),
    (v_couple_id, v_user_male, v_med2_id, '2026-11-05', 'DRANK', '13:00', '2026-11-05 13:12:00+03'),
    (v_couple_id, v_user_female, v_med3_id, '2026-11-05', 'DRANK', '09:30', '2026-11-05 09:32:00+03'),
    (v_couple_id, v_user_female, v_med4_id, '2026-11-05', 'DRANK', '21:30', '2026-11-05 21:40:00+03'),
    (v_couple_id, v_user_male, v_med1_id, '2026-11-06', 'DRANK', '09:00', '2026-11-06 09:02:00+03'),
    (v_couple_id, v_user_female, v_med3_id, '2026-11-06', 'DRANK', '09:30', '2026-11-06 09:35:00+03');

  -- 5. Takvim Notları: Türkçe Planlar & Seyahatler
  DELETE FROM public.calendar_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.calendar_notes (couple_id, user_id, date, note)
  VALUES
    (v_couple_id, v_user_male, '2026-10-30', '1. Yıl Dönümü Akşam Yemeğimiz 🥂'),
    (v_couple_id, v_user_female, '2026-11-04', 'Stockholm Uçuşu & Bavul Hazırlığı ✈️'),
    (v_couple_id, v_user_male, '2026-11-08', 'Prag Hafta Sonu Kaçamağı 🏰'),
    (v_couple_id, v_user_female, '2026-11-15', 'Evde Pizza & Film Gecesi 🎬'),
    (v_couple_id, v_user_male, '2026-11-20', 'Burgaz Sahil Gezisi & Gün Batımı 🌊'),
    (v_couple_id, v_user_female, '2026-11-25', 'Van Gölü Gezisi & Akdamar Adası 🌅'),
    (v_couple_id, v_user_male, '2026-11-28', 'Alaçatı Sokakları & Rüzgar Gülleri 🌸');

  -- 6. Günlük Aşk Notları: Samimi Türkçe Notlar
  DELETE FROM public.daily_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.daily_notes (couple_id, user_id, date, content)
  VALUES
    (v_couple_id, v_user_male, '2026-11-06', 'Sabah erken kalkıp kahveleri hazırladım. Uyurken yüzündeki o huzuru izlemek beni dünyanın en şanslı insanı hissettiriyor. Seni çok seviyorum ❤️'),
    (v_couple_id, v_user_female, '2026-11-06', 'Güne senin varlığına şükrederek başladım. Bana her gün kendimi prenses gibi hissettirdiğin için teşekkür ederim ✨'),
    (v_couple_id, v_user_male, '2026-11-05', 'Şehir ışıklarının altında, radyoda en sevdiğimiz şarkı çalarken yaptığımız o gece sürüşü... Kusursuz bir andı.'),
    (v_couple_id, v_user_female, '2026-11-05', 'Hafta sonu çektiğimiz fotoğraflara bakıp duruyorum, yüzümdeki tebessümü gizleyemiyorum. İyi ki benimsin.'),
    (v_couple_id, v_user_male, '2026-11-04', 'Sonbahar serinliği, sıcak kazaklar ve avucumun içindeki elin. Dünyada bundan daha güzel bir his yok.'),
    (v_couple_id, v_user_female, '2026-11-04', 'Masama bıraktığın o sürpriz çiçekler bütün günümü aydınlattı! Sen hayatımın en güzel mucizesisin 🌸');

  -- 7. Anılar: Türkçe Başlık ve Açıklamalar (Görsel Yolları Korundu)
  UPDATE public.memories
  SET title = '1. Yıl Dönümümüz 🌷',
      description = 'Hikâyemizin ilk yılını mum ışığında kutladık. İyi ki varsın, iyi ki biz varız.'
  WHERE couple_id = v_couple_id AND id = 73;

  UPDATE public.memories
  SET title = 'Barselona''da Yaz Sonu 🌊',
      description = 'Akdeniz dalgalarına karşı oturup geleceğimizi konuştuk. Denizin kokusu hâlâ burnumda.'
  WHERE couple_id = v_couple_id AND id = 71;

  UPDATE public.memories
  SET title = 'Alpler''de Yıldızların Altında ✨',
      description = 'Çadırımızın önünde Samanyolu''nu izledik. "Bizim yıldızımız hangisi?" diye fısıldaştık.'
  WHERE couple_id = v_couple_id AND id = 72;

  UPDATE public.memories
  SET title = 'Kapadokya''da Balonlar 🎈',
      description = 'Sabah beşte kalkıp balonların yükselişini izledik. İkimiz de aynı anda aynı dileği tuttuk.'
  WHERE couple_id = v_couple_id AND id = 70;

  UPDATE public.memories
  SET title = 'Karlar Altında İlk Yürüyüşümüz ❄️',
      description = 'Lapa lapa kar yağarken saatlerce yürüdük. Ellerimiz üşüdü ama kalbimiz sıcacıktı.'
  WHERE couple_id = v_couple_id AND id = 69;

  UPDATE public.memories
  SET title = 'Sevgili Olma Yıl Dönümümüz 💕',
      description = 'Aşkımızın resmi olarak başladığı o büyülü gün...'
  WHERE couple_id = v_couple_id AND id = 44;

  UPDATE public.memories
  SET title = 'Tanışma Günümüz ✨',
      description = 'Hayatımın dönüm noktası, gözlerimin gözlerine ilk değdiği an...'
  WHERE couple_id = v_couple_id AND id = 43;

  -- 8. Buluşma: Burgaz Konumu Korundu, Türkçe Başlık
  UPDATE public.meetings
  SET title = 'Burgaz Sahil Parkı''nda Gün Batımı 🌅',
      location_name = 'Burgaz, Bulgaristan'
  WHERE couple_id = v_couple_id;

  -- 9. Harita Notları: Konumlar Aynen Korundu, Türkçe İçerik
  UPDATE public.map_notes
  SET note = 'Seninle Alfama''nın taş yokuşlarında 28 numaralı nostaljik tramvaya binmek 🚋 (Lizbon)'
  WHERE couple_id = v_couple_id AND latitude = 38.7115;

  UPDATE public.map_notes
  SET note = 'Temple Bar''da canlı akustik ezgileri dinleyip kahkahalar attığımız o yağmurlu gün 🎻 (Dublin)'
  WHERE couple_id = v_couple_id AND latitude = 53.3498;

  UPDATE public.map_notes
  SET note = 'Şehir uyanmadan önce Karl Köprüsü''nde sisler arasında gün doğumunu izlemek 🏰 (Prag)'
  WHERE couple_id = v_couple_id AND latitude = 50.0865;

  UPDATE public.map_notes
  SET note = 'Renkli Nyhavn limanında sıcacık tarçınlı çörek kokusu ve ellerimiz 🥐 (Kopenhag)'
  WHERE couple_id = v_couple_id AND latitude = 55.6795;

  -- 10. Fotoğraf Arşivi:
  -- A) Mevcut Avrupa fotoğraflarının konumları KORUNDU, başlık ve açıklamaları Türkçe yapıldı:
  UPDATE public.photo_archive
  SET title = 'Eyfel Kulesi Altında Sonbahar 🗼',
      description = 'Sen Nehri kıyısında sıcak kruvasanımız ve ellerimiz hiç ayrılmadan...',
      location_name = 'Paris, Fransa'
  WHERE couple_id = v_couple_id AND id = 'c6342ba9-3d05-45dd-b818-1f6ddf17ce27';

  UPDATE public.photo_archive
  SET title = 'İskoç Yaylalarında Yolculuk 🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      description = 'Yeşil tepeler, sisli göller ve serin rüzgarda birbirimize sarıldığımız anlar.',
      location_name = 'İskoçya, Birleşik Krallık'
  WHERE couple_id = v_couple_id AND id = 'ff0aae0d-ee6a-4d80-a313-da40394c3f36';

  UPDATE public.photo_archive
  SET title = 'Stockholm Gamla Stan & Sahil 🇸🇪',
      description = 'Tarihi renkli sokaklarda yürüyüş ve kanaldan geçen tekneleri izlerken...',
      location_name = 'Stockholm, İsveç'
  WHERE couple_id = v_couple_id AND id = 'b07878b7-18ea-48ff-a2f4-6d5227979516';

  UPDATE public.photo_archive
  SET title = 'Barceloneta Sahilinde Gün Batımı 🌊',
      description = 'Ilık Akdeniz esintisi, tapaslar ve dalgaların huzur veren sesi.',
      location_name = 'Barselona, İspanya'
  WHERE couple_id = v_couple_id AND id = '59d41a6d-16ee-44a5-852d-ccada8adc716';

  UPDATE public.photo_archive
  SET title = 'Trevi Çeşmesi''nde Dilek ✨',
      description = 'Omzumuzun üzerinden bozuk parayı atarken ikimiz de aynı dileği tuttuk.',
      location_name = 'Roma, İtalya'
  WHERE couple_id = v_couple_id AND id = 'ee417afc-3681-4907-a4ce-d84574d9e6d1';

  UPDATE public.photo_archive
  SET title = 'Oia Gün Batımı & Kaldera 🌅',
      description = 'Beyaz çatılar, masmavi Ege denizi ve kollarımın arasında sen.',
      location_name = 'Santorini, Yunanistan'
  WHERE couple_id = v_couple_id AND id = '4c3d1111-ca66-497d-a0ad-d7cc9de642ea';

  -- B) TÜRKİYE'NİN BİRİ BİR UCUNA, DİĞERİ DİĞER UCUNA 2 FOTOĞRAF:
  -- BATI UCU: Çeşme / Alaçatı (İzmir) -> lat: 38.3193, lng: 26.3038
  UPDATE public.photo_archive
  SET title = 'Alaçatı Sokakları & Rüzgar Gülleri 🌸',
      description = 'Taş evlerin arasında kaybolduğumuz, begonvillerle dolu o sıcacık Ege günü.',
      location_name = 'Çeşme, İzmir',
      latitude = 38.3193,
      longitude = 26.3038,
      taken_date = '2026-10-12'
  WHERE couple_id = v_couple_id AND id = 'bde537c5-4f95-4ed6-93ae-d03bbdaea121';

  -- DOĞU UCU: Van Gölü / Akdamar -> lat: 38.3400, lng: 43.0360
  UPDATE public.photo_archive
  SET title = 'Van Gölü & Akdamar Gün Batımı 🌅',
      description = 'Gölün dingin suları, batan güneş ve gözlerindeki o tarifsiz huzur...',
      location_name = 'Van Gölü, Van',
      latitude = 38.3400,
      longitude = 43.0360,
      taken_date = '2026-10-05'
  WHERE couple_id = v_couple_id AND id = '48883a96-612e-45f7-856c-78bce6c881ed';

  -- C) Diğer harita dışı fotoğrafların başlık/açıklamaları Türkçe:
  UPDATE public.photo_archive
  SET title = 'Evde Birlikte Makarna Akşamı 🍝',
      description = 'Burnumuzda un, mutfak darmadağın ama sosumuz enfesti!'
  WHERE couple_id = v_couple_id AND id = 'b6a6e14a-2ffd-486f-b257-0ba5e5ec3d20';

  UPDATE public.photo_archive
  SET title = 'Battaniye Altında Film Gecesi 🎬',
      description = 'Mısırımız, sıcacık battaniyemiz ve en sevdiğimiz cuma filmi.'
  WHERE couple_id = v_couple_id AND id = 'c2eada4e-cd48-4bcb-ba37-7b4e2d9fd9ab';

  UPDATE public.photo_archive
  SET title = 'Sahaflar ve Eski Kitaplar 📚',
      description = 'Yüksek rafların arasında sana gizlice şiir kitabı seçerken yakalandım.'
  WHERE couple_id = v_couple_id AND id = 'd0263b6d-22a2-46bf-97eb-abf98d43fd87';

  UPDATE public.photo_archive
  SET title = 'Çay & Sohbet Molası 🫖',
      description = 'Günün yorgunluğunu unutturan sıcacık bir fincan çay ve sen.'
  WHERE couple_id = v_couple_id AND id = 'c5130893-c44a-445b-b142-24516b102056';

  UPDATE public.photo_archive
  SET title = 'Karlar Altında İlk Yürüyüşümüz ❄️',
      description = 'Lapa lapa kar yağarken el ele... Kalbimiz hiç olmadığı kadar sıcaktı.'
  WHERE couple_id = v_couple_id AND id = '988e9c4e-805c-4380-b0e5-9f8f8cbe8422';

END $$;

COMMIT;


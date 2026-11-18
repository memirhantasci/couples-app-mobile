-- ==============================================================================
-- MARKETING EN MOCK DATA FOR COUPLE ID 165 (App Store / Play Store Testers)
-- ==============================================================================

BEGIN;

SET LOCAL app.allow_dates_change = 'true';
SET LOCAL app.allow_dates_override = 'true';
SET LOCAL app.allow_premium_override = 'true';
SET LOCAL app.allow_subscription_lifecycle = 'true';
SET LOCAL app.allow_profile_override = 'true';
SET LOCAL app.suppress_push = 'true';

DO $$
DECLARE
  v_couple_id INT := 165;
  v_user_male UUID;
  v_user_female UUID;
  v_user_count INT;
  v_med1_id INT;
  v_med2_id INT;
  v_med3_id INT;
  v_med4_id INT;
BEGIN

  PERFORM set_config('app.allow_dates_change', 'true', true);
  PERFORM set_config('app.allow_dates_override', 'true', true);
  PERFORM set_config('app.allow_premium_override', 'true', true);
  PERFORM set_config('app.allow_subscription_lifecycle', 'true', true);
  PERFORM set_config('app.allow_profile_override', 'true', true);
  PERFORM set_config('app.suppress_push', 'true', true);

  -- 0. Kullanıcıları tespit et
  SELECT id INTO v_user_male FROM public.users WHERE couple_id = v_couple_id ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_user_female FROM public.users WHERE couple_id = v_couple_id ORDER BY created_at DESC LIMIT 1;

  IF v_user_male IS NULL THEN
    RAISE EXCEPTION 'Hata: Couple ID % için kullanıcı bulunamadı!', v_couple_id;
  END IF;

  SELECT COUNT(*) INTO v_user_count FROM public.users WHERE couple_id = v_couple_id;
  IF v_user_female IS NULL OR v_user_female = v_user_male THEN
    v_user_female := v_user_male;
  END IF;

  -- 1. Premium & İlişki Tarihleri (is_paired generated sütun olduğundan UPDATE edilmez)
  UPDATE public.couples
  SET is_premium = true,
      premium_expires_at = NOW() + INTERVAL '10 years',
      subscription_status = 'active'::subscription_status,
      relationship_start_date = (CURRENT_DATE - 365)::date,
      meet_date = (CURRENT_DATE - 500)::date,
      dates_set_at = NOW(),
      dates_last_changed_at = NULL,
      dates_change_period = NULL,
      dates_change_count = 0,
      paired_at = NOW() - INTERVAL '1000 days',
      member_count = v_user_count::int2
  WHERE id = v_couple_id;

  -- 2. Kullanıcı İsimleri & Cinsiyetleri (Regl kontrolleri için gender 'female' tanımlanır)
  IF v_user_count >= 2 AND v_user_female != v_user_male THEN
    UPDATE public.users SET display_name = 'Liam', username = 'liam', gender = 'male' WHERE id = v_user_male;
    UPDATE public.users SET display_name = 'Emma 💕', username = 'emma', gender = 'female' WHERE id = v_user_female;
  ELSE
    UPDATE public.users SET display_name = 'Liam', username = 'liam', gender = 'male' WHERE id = v_user_male;
  END IF;

  -- 3. Yıldız Bilgileri
  UPDATE public.couple_stars SET custom_name = 'Eternity', owner_initials = 'L 💕 E' WHERE couple_id = v_couple_id;

  -- 4. Storage Dosyalarını 132'den 165'e Kopyalamayı Dene (Direct DELETE yapılmaz, protect_delete trigger'ı engeller)
  BEGIN
    INSERT INTO storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
    SELECT DISTINCT ON (s.bucket_id, regexp_replace(s.name, '^[^/]+/', v_couple_id::text || '/'))
      gen_random_uuid(),
      s.bucket_id,
      regexp_replace(s.name, '^[^/]+/', v_couple_id::text || '/'),
      v_user_male,
      NOW(), NOW(), NOW(),
      s.metadata
    FROM storage.objects s
    WHERE s.bucket_id IN ('photos', 'memories')
      AND s.name LIKE '132/%'
      AND NOT EXISTS (
        SELECT 1 FROM storage.objects e
        WHERE e.bucket_id = s.bucket_id
          AND e.name = regexp_replace(s.name, '^[^/]+/', v_couple_id::text || '/')
      );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Storage 132 kopyalama notu: %', SQLERRM;
  END;

  -- 5. Fotoğraf Arşivi (photo_archive_paths_in_couple_folder kuralına uygun 165/ yolları)
  DELETE FROM public.photo_archive WHERE couple_id = v_couple_id;

  -- 132'deki fotoğrafları 165 yoluyla kopyala
  INSERT INTO public.photo_archive (
    id, couple_id, user_id, storage_path, thumb_path, title, description, taken_date, taken_time, latitude, longitude, location_name, created_at
  )
  SELECT 
    gen_random_uuid(),
    v_couple_id,
    v_user_male,
    regexp_replace(storage_path, '^[^/]+/', v_couple_id::text || '/'),
    CASE WHEN thumb_path IS NOT NULL AND thumb_path != '' 
         THEN regexp_replace(thumb_path, '^[^/]+/', v_couple_id::text || '/') 
         ELSE NULL END,
    title,
    description,
    taken_date,
    taken_time,
    latitude,
    longitude,
    location_name,
    NOW()
  FROM public.photo_archive
  WHERE couple_id = 132;

  -- Eğer 132'den fotoğraf gelmediyse örnek kayıtlar oluştur
  IF NOT EXISTS (SELECT 1 FROM public.photo_archive WHERE couple_id = v_couple_id) THEN
    BEGIN
      INSERT INTO storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata)
      SELECT 
        gen_random_uuid(),
        'photos',
        v_couple_id::text || '/sample_' || s.n || '.jpg',
        v_user_male,
        NOW(), NOW(), NOW(),
        o.metadata
      FROM (SELECT metadata FROM storage.objects WHERE bucket_id = 'photos' LIMIT 1) o
      CROSS JOIN generate_series(1, 10) s(n)
      WHERE NOT EXISTS (
        SELECT 1 FROM storage.objects e
        WHERE e.bucket_id = 'photos'
          AND e.name = v_couple_id::text || '/sample_' || s.n || '.jpg'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Storage sample ekleme notu: %', SQLERRM;
    END;

    INSERT INTO public.photo_archive (
      id, couple_id, user_id, storage_path, thumb_path, title, description, taken_date, taken_time, latitude, longitude, location_name, created_at
    )
    SELECT
      gen_random_uuid(),
      v_couple_id,
      v_user_male,
      v_couple_id::text || '/sample_' || s.n || '.jpg',
      v_couple_id::text || '/sample_' || s.n || '.jpg',
      'Sweet Travel Memory ✨',
      'An unforgettable day recorded together.',
      (CURRENT_DATE - (s.n * 2))::date,
      '14:00:00'::time,
      51.5055::numeric,
      -0.0754::numeric,
      'London, UK',
      NOW()
    FROM generate_series(1, 10) s(n);
  END IF;

  -- Fotoğrafları İngilizce başlık, açıklama ve güncel tarihlerle donat
  UPDATE public.photo_archive
  SET title = sub.new_title,
      description = sub.new_desc,
      location_name = sub.new_loc,
      latitude = sub.new_lat,
      longitude = sub.new_lng,
      taken_date = sub.new_date
  FROM (
    SELECT id,
           CASE (ROW_NUMBER() OVER (ORDER BY taken_date DESC, id ASC))
             WHEN 1 THEN 'Sunset by Tower Bridge 🌇'
             WHEN 2 THEN 'Afternoon Picnic in Hyde Park 🧺'
             WHEN 3 THEN 'Rainy Afternoon in Notting Hill ☕'
             WHEN 4 THEN 'Autumn by the Eiffel Tower 🗼'
             WHEN 5 THEN 'Trevi Fountain Coin Toss ✨'
             WHEN 6 THEN 'Canal Cycling & Fresh Pastries 🚲🌷'
             WHEN 7 THEN 'Palace Gardens Waltz 🎻🏰'
             WHEN 8 THEN 'Hot Air Balloons at Dawn 🎈🌅'
             WHEN 9 THEN 'Turquoise Magic of the Coast 🌊🏖️'
             WHEN 10 THEN 'Misty Mountain Highlands 🌲⛰️'
             ELSE 'Cobblestone Streets & Bougainvillea 🌸🏡'
           END AS new_title,
           CASE (ROW_NUMBER() OVER (ORDER BY taken_date DESC, id ASC))
             WHEN 1 THEN 'Watching the golden sky reflect on the Thames as the city lights turned on.'
             WHEN 2 THEN 'Strawberries, vintage picnic blanket, and endless laughter under the trees.'
             WHEN 3 THEN 'Heart-shaped foam on our flat whites while the rain tapped gently on the window.'
             WHEN 4 THEN 'Walking along the Seine holding warm croissants and your hand.'
             WHEN 5 THEN 'Tossing a coin over our shoulders and wishing for a lifetime together.'
             WHEN 6 THEN 'Getting lost hand-in-hand as golden leaves drifted along the quiet canals.'
             WHEN 7 THEN 'A fairy-tale afternoon listening to violin melodies echoing through the gardens.'
             WHEN 8 THEN 'Waking up at dawn to watch hundreds of hot air balloons fill the pastel sky.'
             WHEN 9 THEN 'Descending the steps to discover that endless blue sea and the wind in your hair.'
             WHEN 10 THEN 'Holding hands in the cool mountain breeze wrapped in a cozy wool blanket.'
             ELSE 'Strolling among stone cottages and sipping iced tea under blossoming flowers.'
           END AS new_desc,
           CASE (ROW_NUMBER() OVER (ORDER BY taken_date DESC, id ASC))
             WHEN 1 THEN 'Tower Bridge, London'
             WHEN 2 THEN 'Hyde Park, London'
             WHEN 3 THEN 'Notting Hill, London'
             WHEN 4 THEN 'Paris, France'
             WHEN 5 THEN 'Rome, Italy'
             WHEN 6 THEN 'Amsterdam, Netherlands'
             WHEN 7 THEN 'Vienna, Austria'
             WHEN 8 THEN 'Cappadocia'
             WHEN 9 THEN 'Mediterranean Coast'
             WHEN 10 THEN 'Scottish Highlands, UK'
             ELSE 'Old Village'
           END AS new_loc,
           CASE (ROW_NUMBER() OVER (ORDER BY taken_date DESC, id ASC))
             WHEN 1 THEN 51.5055::numeric
             WHEN 2 THEN 51.5073::numeric
             WHEN 3 THEN 51.5173::numeric
             WHEN 4 THEN 48.8584::numeric
             WHEN 5 THEN 41.9009::numeric
             WHEN 6 THEN 52.3676::numeric
             WHEN 7 THEN 48.1914::numeric
             WHEN 8 THEN 38.6431::numeric
             WHEN 9 THEN 36.2289::numeric
             WHEN 10 THEN 56.5000::numeric
             ELSE 37.9405::numeric
           END AS new_lat,
           CASE (ROW_NUMBER() OVER (ORDER BY taken_date DESC, id ASC))
             WHEN 1 THEN (-0.0754)::numeric
             WHEN 2 THEN (-0.1696)::numeric
             WHEN 3 THEN (-0.2057)::numeric
             WHEN 4 THEN 2.2945::numeric
             WHEN 5 THEN 12.4833::numeric
             WHEN 6 THEN 4.9041::numeric
             WHEN 7 THEN 16.3808::numeric
             WHEN 8 THEN 34.8289::numeric
             WHEN 9 THEN 29.4491::numeric
             WHEN 10 THEN (-4.2000)::numeric
             ELSE 27.4331::numeric
           END AS new_lng,
           CASE (ROW_NUMBER() OVER (ORDER BY taken_date DESC, id ASC))
             WHEN 1 THEN CURRENT_DATE::date
             WHEN 2 THEN (CURRENT_DATE - 1)::date
             WHEN 3 THEN (CURRENT_DATE - 2)::date
             WHEN 4 THEN (CURRENT_DATE - 4)::date
             WHEN 5 THEN (CURRENT_DATE - 6)::date
             WHEN 6 THEN (CURRENT_DATE - 8)::date
             WHEN 7 THEN (CURRENT_DATE - 11)::date
             WHEN 8 THEN (CURRENT_DATE - 14)::date
             WHEN 9 THEN (CURRENT_DATE - 18)::date
             WHEN 10 THEN (CURRENT_DATE - 22)::date
             ELSE (CURRENT_DATE - 26)::date
           END AS new_date
    FROM public.photo_archive
    WHERE couple_id = v_couple_id
  ) sub
  WHERE public.photo_archive.id = sub.id;

  -- 6. Ruh Halleri (Son 14 Gün Kesintisiz - 30 Kayıt)
  DELETE FROM public.moods WHERE couple_id = v_couple_id;

  INSERT INTO public.moods (couple_id, user_id, date, mood_type)
  VALUES 
    (v_couple_id, v_user_male, CURRENT_DATE::date, '😍'), (v_couple_id, v_user_female, CURRENT_DATE::date, '🥰'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 1)::date, '😊'), (v_couple_id, v_user_female, (CURRENT_DATE - 1)::date, '😍'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 2)::date, '🥰'), (v_couple_id, v_user_female, (CURRENT_DATE - 2)::date, '🥰'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 3)::date, '✨'), (v_couple_id, v_user_female, (CURRENT_DATE - 3)::date, '😊'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 4)::date, '😍'), (v_couple_id, v_user_female, (CURRENT_DATE - 4)::date, '✨'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 5)::date, '😊'), (v_couple_id, v_user_female, (CURRENT_DATE - 5)::date, '😍'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 6)::date, '🥰'), (v_couple_id, v_user_female, (CURRENT_DATE - 6)::date, '🥰'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 7)::date, '✨'), (v_couple_id, v_user_female, (CURRENT_DATE - 7)::date, '😊'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 8)::date, '😍'), (v_couple_id, v_user_female, (CURRENT_DATE - 8)::date, '😍'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 9)::date, '😊'), (v_couple_id, v_user_female, (CURRENT_DATE - 9)::date, '✨'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 10)::date, '🥰'), (v_couple_id, v_user_female, (CURRENT_DATE - 10)::date, '🥰'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 11)::date, '😍'), (v_couple_id, v_user_female, (CURRENT_DATE - 11)::date, '😊'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 12)::date, '✨'), (v_couple_id, v_user_female, (CURRENT_DATE - 12)::date, '😍'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 13)::date, '😊'), (v_couple_id, v_user_female, (CURRENT_DATE - 13)::date, '🥰'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 14)::date, '😍'), (v_couple_id, v_user_female, (CURRENT_DATE - 14)::date, '✨');

  -- 7. Takvim Notları (15 Adet)
  DELETE FROM public.calendar_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.calendar_notes (couple_id, user_id, date, note)
  VALUES
    (v_couple_id, v_user_male, (CURRENT_DATE - 7)::date, 'Morning coffee & freshly baked cinnamon rolls ☕'),
    (v_couple_id, v_user_female, (CURRENT_DATE - 5)::date, 'Sunset bicycle ride along the river 🚲'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 3)::date, 'Bought flight tickets for our anniversary getaway ✈️'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 2)::date, 'Our 1st Anniversary Candlelight Dinner 🥂'),
    (v_couple_id, v_user_female, (CURRENT_DATE - 1)::date, 'Baking homemade chocolate chip cookies together 🍪'),
    (v_couple_id, v_user_female, CURRENT_DATE::date, 'Cozy Autumn Walk & Hot Chocolate in Hyde Park 🍂☕'),
    (v_couple_id, v_user_male, (CURRENT_DATE + 1)::date, 'Vintage bookstore stroll & reading date 📚'),
    (v_couple_id, v_user_male, (CURRENT_DATE + 3)::date, 'Book weekend tickets to the Cotswolds 🧳🏡'),
    (v_couple_id, v_user_female, (CURRENT_DATE + 5)::date, 'Sunday Brunch & Gallery Visit 🎨'),
    (v_couple_id, v_user_female, (CURRENT_DATE + 7)::date, 'Homemade Italian pasta night at home 🍝'),
    (v_couple_id, v_user_male, (CURRENT_DATE + 10)::date, 'Stargazing Night & telescope picnic 🌟'),
    (v_couple_id, v_user_female, (CURRENT_DATE + 14)::date, 'Acoustic Live Concert in London 🎵'),
    (v_couple_id, v_user_male, (CURRENT_DATE + 18)::date, 'Modern Art Museum exhibition date 🖼️'),
    (v_couple_id, v_user_male, (CURRENT_DATE + 22)::date, 'Ice Skating at Somerset House ⛸️❄️'),
    (v_couple_id, v_user_female, (CURRENT_DATE + 28)::date, 'Planning our winter holiday getaway 🎄✨');

  -- 8. Buluşmalar
  DELETE FROM public.meetings WHERE couple_id = v_couple_id;

  INSERT INTO public.meetings (couple_id, user_id, title, location_name, latitude, longitude, meeting_datetime, is_active)
  VALUES
    (v_couple_id, v_user_male, 'Dinner & Cocktails in Covent Garden 🍸', 'Covent Garden, London', 51.5129, -0.1243, (CURRENT_DATE + TIME '19:30:00')::timestamptz, true),
    (v_couple_id, v_user_female, 'Little Venice Canal Walk & Brunch 🥐', 'Little Venice, London', 51.5226, -0.1834, (NOW() + INTERVAL '3 days 11 hours 30 minutes')::timestamptz, true),
    (v_couple_id, v_user_male, 'Sunset Walk & Coffee by the Pagoda 🌅', 'Battersea Park, London', 51.4791, -0.1567, (NOW() + INTERVAL '7 days 16 hours')::timestamptz, true),
    (v_couple_id, v_user_female, 'West End Musical Theatre Night 🎭', 'Soho, London', 51.5134, -0.1310, (NOW() + INTERVAL '12 days 20 hours')::timestamptz, true);

  -- 9. Regl Döngü Başlangıç Günleri (Biyolojik 28 gün aralık kuralına ve female şartına tam uyumlu)
  BEGIN
    DELETE FROM public.period_logs WHERE couple_id = v_couple_id;

    IF v_user_count >= 2 AND v_user_female != v_user_male THEN
      INSERT INTO public.period_logs (id, couple_id, user_id, date, created_at)
      VALUES
        (gen_random_uuid(), v_couple_id, v_user_female, (CURRENT_DATE - 14)::date, NOW() - INTERVAL '14 days'),
        (gen_random_uuid(), v_couple_id, v_user_female, (CURRENT_DATE - 42)::date, NOW() - INTERVAL '42 days'),
        (gen_random_uuid(), v_couple_id, v_user_female, (CURRENT_DATE - 70)::date, NOW() - INTERVAL '70 days');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Regl takvimi notu: %', SQLERRM;
  END;

  -- 10. Anılar (memories_image_in_couple_folder kuralına tam uyumlu)
  BEGIN
    DELETE FROM public.memories WHERE couple_id = v_couple_id;

    INSERT INTO public.memories (couple_id, date, title, description, is_default, image_path, created_by)
    SELECT 
      v_couple_id,
      date,
      title,
      description,
      is_default,
      CASE WHEN image_path IS NOT NULL AND position('/' in image_path) > 0
           THEN regexp_replace(image_path, '^[^/]+/', v_couple_id::text || '/')
           ELSE NULL END,
      v_user_male
    FROM public.memories
    WHERE couple_id = 132;

    IF NOT EXISTS (SELECT 1 FROM public.memories WHERE couple_id = v_couple_id) THEN
      INSERT INTO public.memories (couple_id, date, title, description, is_default, image_path, created_by)
      VALUES
        (v_couple_id, (CURRENT_DATE - 2)::date, 'Our 1st Anniversary 🌷', 'Celebrated our very first year together under soft candlelight. So grateful for forever.', false, NULL, v_user_male),
        (v_couple_id, (CURRENT_DATE - 20)::date, 'End of Summer by the Sea 🌊', 'Sitting by the ocean waves at sunset, talking about our dreams and our future together.', false, NULL, v_user_female),
        (v_couple_id, (CURRENT_DATE - 50)::date, 'Under the Starlit Sky ✨', 'Camping outside our tent under the Milky Way. Laughing together wondering which star is ours.', false, NULL, v_user_male),
        (v_couple_id, (CURRENT_DATE - 90)::date, 'Hot Air Balloons at Dawn 🎈', 'Woke up at dawn to watch hundreds of hot air balloons fill the morning sky. We held hands and made a secret wish.', false, NULL, v_user_female),
        (v_couple_id, (CURRENT_DATE - 140)::date, 'Parisian Walk along the Seine 🗼', 'Our first trip abroad together. The city of lights never felt brighter than with you.', false, NULL, v_user_male);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Anılar notu: %', SQLERRM;
  END;

  -- 11. Mektuplar (2 Açık, 2 İleri Tarihli Mühürlü)
  DELETE FROM public.letters WHERE couple_id = v_couple_id;

  INSERT INTO public.letters (sender_id, receiver_id, title, content, unlock_date, couple_id, hidden_by_sender, hidden_by_receiver)
  VALUES 
    (v_user_male, v_user_female, 'The Day I Met You ✨', 'I still remember the first time our eyes met. It felt as if time slowed down just for us. Every day with you since then has been the greatest adventure of my life. Thank you for filling my world with light and warmth. I love you endlessly.', (CURRENT_DATE - 15)::date, v_couple_id, false, false),
    (v_user_female, v_user_male, 'My Favorite Person in the World 🤍', 'Happy Anniversary, my love! A whole year of laughter, cozy morning coffees, and unforgettable memories. Whenever I am with you, I feel completely at home. You are my greatest comfort, my best friend, and my whole heart.', (CURRENT_DATE - 2)::date, v_couple_id, false, false),
    (v_user_male, v_user_female, 'To Our Future Selves 🌙', 'If you are reading this, another beautiful season has passed with us side by side. I wrote this to remind you that no matter how fast the world moves, my love for you only grows deeper with every single heartbeat. Happy Valentine’s Day, my forever person.', (CURRENT_DATE + 90)::date, v_couple_id, false, false),
    (v_user_female, v_user_male, 'A Little Surprise For You 🎁', 'Merry Christmas, darling! I have hidden a little present where we keep our favorite travel photos. May our next year together be filled with even more magic, warm embraces, and endless smiles.', (CURRENT_DATE + 45)::date, v_couple_id, false, false);

  -- 12. İlaçlar & Loglar
  DELETE FROM public.medicine_logs WHERE couple_id = v_couple_id;
  DELETE FROM public.medicines WHERE couple_id = v_couple_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_male, 'Vitamin D3 (2000 IU)', '09:00:00'::time, ARRAY['09:00'], (CURRENT_DATE - 30)::date, (CURRENT_DATE + 335)::date, true)
  RETURNING id INTO v_med1_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_male, 'Omega-3 Fish Oil', '13:00:00'::time, ARRAY['13:00'], (CURRENT_DATE - 30)::date, (CURRENT_DATE + 335)::date, true)
  RETURNING id INTO v_med2_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_female, 'Daily Multivitamin', '09:30:00'::time, ARRAY['09:30'], (CURRENT_DATE - 30)::date, (CURRENT_DATE + 335)::date, true)
  RETURNING id INTO v_med3_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_female, 'Magnesium Complex', '21:30:00'::time, ARRAY['21:30'], (CURRENT_DATE - 30)::date, (CURRENT_DATE + 335)::date, true)
  RETURNING id INTO v_med4_id;

  INSERT INTO public.medicine_logs (couple_id, user_id, medicine_id, date, status, time, taken_at)
  VALUES
    (v_couple_id, v_user_male, v_med1_id, (CURRENT_DATE - 1)::date, 'DRANK', '09:00', (NOW() - INTERVAL '1 day' + INTERVAL '9 hours 5 minutes')::timestamptz),
    (v_couple_id, v_user_male, v_med2_id, (CURRENT_DATE - 1)::date, 'DRANK', '13:00', (NOW() - INTERVAL '1 day' + INTERVAL '13 hours 12 minutes')::timestamptz),
    (v_couple_id, v_user_female, v_med3_id, (CURRENT_DATE - 1)::date, 'DRANK', '09:30', (NOW() - INTERVAL '1 day' + INTERVAL '9 hours 32 minutes')::timestamptz),
    (v_couple_id, v_user_female, v_med4_id, (CURRENT_DATE - 1)::date, 'DRANK', '21:30', (NOW() - INTERVAL '1 day' + INTERVAL '21 hours 40 minutes')::timestamptz),
    (v_couple_id, v_user_male, v_med1_id, CURRENT_DATE::date, 'DRANK', '09:00', (NOW() - INTERVAL '2 hours')::timestamptz),
    (v_couple_id, v_user_male, v_med2_id, CURRENT_DATE::date, 'DRANK', '13:00', (NOW() - INTERVAL '1 hour')::timestamptz),
    (v_couple_id, v_user_female, v_med3_id, CURRENT_DATE::date, 'DRANK', '09:30', (NOW() - INTERVAL '2 hours 30 minutes')::timestamptz),
    (v_couple_id, v_user_female, v_med4_id, CURRENT_DATE::date, 'DRANK', '21:30', (NOW() - INTERVAL '30 minutes')::timestamptz);

  -- 13. Günlük Notlar (8 Adet)
  DELETE FROM public.daily_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.daily_notes (couple_id, user_id, date, content)
  VALUES
    (v_couple_id, v_user_male, CURRENT_DATE::date, 'Woke up early and made us coffee. Watching you sleep so peacefully made me realize all over again how lucky I am. ❤️'),
    (v_couple_id, v_user_female, CURRENT_DATE::date, 'Starting today with a grateful heart. Thank you for always making me feel so cherished. ✨'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 1)::date, 'Late night drive through the city lights with our favorite playlist on repeat. Perfect night.'),
    (v_couple_id, v_user_female, (CURRENT_DATE - 1)::date, 'Can’t stop smiling looking at our photos from the weekend. You are my favorite human.'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 2)::date, 'Crisp autumn air, warm sweaters, and your hand in mine. Nothing beats this feeling.'),
    (v_couple_id, v_user_female, (CURRENT_DATE - 2)::date, 'Surprise flowers on my desk! You never fail to brighten my entire world 🌸'),
    (v_couple_id, v_user_male, (CURRENT_DATE - 3)::date, 'Cooking together always turns into dancing in the kitchen. Best chef duo ever! 🍳'),
    (v_couple_id, v_user_female, (CURRENT_DATE - 3)::date, 'Thank you for giving the warmest hugs whenever I need them most. 🤍');

  -- 14. Harita Notları (4 Adet)
  DELETE FROM public.map_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.map_notes (couple_id, user_id, latitude, longitude, note, created_at)
  VALUES
    (v_couple_id, v_user_male, 51.5392, -0.1607, 'The view of the London skyline was breathtaking, but I could only look at you 💫 (Primrose Hill)', NOW() - INTERVAL '15 days'),
    (v_couple_id, v_user_female, 51.4769, 0.0005, 'Standing on the Prime Meridian line together. Time literally began with you here ✨ (Greenwich)', NOW() - INTERVAL '10 days'),
    (v_couple_id, v_user_male, 51.4428, -0.2733, 'Our long autumn bicycle ride among the ancient oaks and wild deer 🦌 (Richmond Park)', NOW() - INTERVAL '6 days'),
    (v_couple_id, v_user_female, 51.5365, -0.0383, 'Sunday morning market, fresh pastries and holding hands in the breeze 🌿 (Victoria Park)', NOW() - INTERVAL '2 days');

END $$;

COMMIT;

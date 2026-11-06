-- ==============================================================================
-- MARKETING EN MOCK DATA FOR COUPLE ID 132 (App Store Screenshots)
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

  -- 1. Update Display Names and Usernames to English
  UPDATE public.users 
  SET display_name = 'Liam', username = 'liam'
  WHERE id = v_user_male;

  UPDATE public.users 
  SET display_name = 'Emma 💕', username = 'emma'
  WHERE id = v_user_female;

  -- 2. Update Star custom name and initials
  UPDATE public.couple_stars
  SET custom_name = 'Eternity', owner_initials = 'L 💕 E'
  WHERE couple_id = v_couple_id;

  -- 3. Letters: Clear & Insert English Letters (Opened & Sealed)
  DELETE FROM public.letters WHERE couple_id = v_couple_id;

  INSERT INTO public.letters (sender_id, receiver_id, title, content, unlock_date, couple_id, hidden_by_sender, hidden_by_receiver)
  VALUES 
    (
      v_user_male, 
      v_user_female, 
      'The Day I Met You ✨', 
      'I still remember the first time our eyes met. It felt as if time slowed down just for us. Every day with you since then has been the greatest adventure of my life. Thank you for filling my world with light and warmth. I love you endlessly.', 
      '2026-10-15', 
      v_couple_id, 
      false, 
      false
    ),
    (
      v_user_female, 
      v_user_male, 
      'My Favorite Person in the World 🤍', 
      'Happy Anniversary, my love! A whole year of laughter, cozy morning coffees, and unforgettable memories. Whenever I am with you, I feel completely at home. You are my greatest comfort, my best friend, and my whole heart.', 
      '2026-10-30', 
      v_couple_id, 
      false, 
      false
    ),
    (
      v_user_male, 
      v_user_female, 
      'To Our Future Selves 🌙', 
      'If you are reading this, another beautiful season has passed with us side by side. I wrote this to remind you that no matter how fast the world moves, my love for you only grows deeper with every single heartbeat. Happy Valentine’s Day, my forever person.', 
      '2027-02-14', 
      v_couple_id, 
      false, 
      false
    ),
    (
      v_user_female, 
      v_user_male, 
      'A Little Surprise For You 🎁', 
      'Merry Christmas, darling! I have hidden a little present where we keep our favorite travel photos. May our next year together be filled with even more magic, warm embraces, and endless smiles.', 
      '2026-12-25', 
      v_couple_id, 
      false, 
      false
    );

  -- 4. Medicines & Logs: Clear & Insert English Medicines
  DELETE FROM public.medicine_logs WHERE couple_id = v_couple_id;
  DELETE FROM public.medicines WHERE couple_id = v_couple_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_male, 'Vitamin D3 (2000 IU)', '09:00:00', ARRAY['09:00'], '2026-10-01', '2027-10-01', true)
  RETURNING id INTO v_med1_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_male, 'Omega-3 Fish Oil', '13:00:00', ARRAY['13:00'], '2026-10-01', '2027-10-01', true)
  RETURNING id INTO v_med2_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_female, 'Daily Multivitamin', '09:30:00', ARRAY['09:30'], '2026-10-01', '2027-10-01', true)
  RETURNING id INTO v_med3_id;

  INSERT INTO public.medicines (couple_id, user_id, name, time, times, start_date, end_date, is_active)
  VALUES (v_couple_id, v_user_female, 'Magnesium Complex', '21:30:00', ARRAY['21:30'], '2026-10-01', '2027-10-01', true)
  RETURNING id INTO v_med4_id;

  -- Medicine Logs (Past 2 days completed with DRANK)
  INSERT INTO public.medicine_logs (couple_id, user_id, medicine_id, date, status, time, taken_at)
  VALUES
    (v_couple_id, v_user_male, v_med1_id, '2026-11-05', 'DRANK', '09:00', '2026-11-05 09:05:00+03'),
    (v_couple_id, v_user_male, v_med2_id, '2026-11-05', 'DRANK', '13:00', '2026-11-05 13:12:00+03'),
    (v_couple_id, v_user_female, v_med3_id, '2026-11-05', 'DRANK', '09:30', '2026-11-05 09:32:00+03'),
    (v_couple_id, v_user_female, v_med4_id, '2026-11-05', 'DRANK', '21:30', '2026-11-05 21:40:00+03'),
    (v_couple_id, v_user_male, v_med1_id, '2026-11-06', 'DRANK', '09:00', '2026-11-06 09:02:00+03'),
    (v_couple_id, v_user_female, v_med3_id, '2026-11-06', 'DRANK', '09:30', '2026-11-06 09:35:00+03');

  -- 5. Calendar Notes: Clear & Insert English Notes
  DELETE FROM public.calendar_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.calendar_notes (couple_id, user_id, date, note)
  VALUES
    (v_couple_id, v_user_male, '2026-10-30', 'Our 1st Anniversary Dinner 🥂'),
    (v_couple_id, v_user_female, '2026-11-04', 'Cozy Autumn Walk & Hot Chocolate ☕'),
    (v_couple_id, v_user_male, '2026-11-06', 'Book weekend tickets to the Cotswolds 🧳'),
    (v_couple_id, v_user_female, '2026-11-08', 'Sunday Brunch & Gallery Visit 🎨'),
    (v_couple_id, v_user_male, '2026-11-14', 'Stargazing Night 🌟'),
    (v_couple_id, v_user_female, '2026-11-20', 'Acoustic Live Concert in London 🎵'),
    (v_couple_id, v_user_male, '2026-11-28', 'Ice Skating at Somerset House ⛸️');

  -- 6. Daily Notes: Clear & Insert Romantic English Notes
  DELETE FROM public.daily_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.daily_notes (couple_id, user_id, date, content)
  VALUES
    (v_couple_id, v_user_male, '2026-11-06', 'Woke up early and made us coffee. Watching you sleep so peacefully made me realize all over again how lucky I am. ❤️'),
    (v_couple_id, v_user_female, '2026-11-06', 'Starting today with a grateful heart. Thank you for always making me feel so cherished. ✨'),
    (v_couple_id, v_user_male, '2026-11-05', 'Late night drive through the city lights with our favorite playlist on repeat. Perfect night.'),
    (v_couple_id, v_user_female, '2026-11-05', 'Can’t stop smiling looking at our photos from the weekend. You are my favorite human.'),
    (v_couple_id, v_user_male, '2026-11-04', 'Crisp autumn air, warm sweaters, and your hand in mine. Nothing beats this feeling.'),
    (v_couple_id, v_user_female, '2026-11-04', 'Surprise flowers on my desk! You never fail to brighten my entire world 🌸');

  -- 7. Memories: Keep Image Paths & Translate Titles/Descriptions to English
  UPDATE public.memories
  SET title = 'Our 1st Anniversary 🌷',
      description = 'Celebrated our very first year together under soft candlelight. So grateful for us, so grateful for forever.'
  WHERE couple_id = v_couple_id AND id = 73;

  UPDATE public.memories
  SET title = 'End of Summer by the Sea 🌊',
      description = 'Sitting by the ocean waves at sunset, talking about our dreams and our future together.'
  WHERE couple_id = v_couple_id AND id = 71;

  UPDATE public.memories
  SET title = 'Under the Starlit Sky ✨',
      description = 'Camping outside our tent under the Milky Way. Laughing together wondering which star is ours.'
  WHERE couple_id = v_couple_id AND id = 72;

  UPDATE public.memories
  SET title = 'Hot Air Balloons at Dawn 🎈',
      description = 'Woke up at dawn to watch hundreds of hot air balloons fill the morning sky. We held hands and made a secret wish.'
  WHERE couple_id = v_couple_id AND id = 70;

  UPDATE public.memories
  SET title = 'Our First Winter Snow ❄️',
      description = 'Walking for hours through the quiet falling snow. My hands were freezing, but my heart was never warmer.'
  WHERE couple_id = v_couple_id AND id = 69;

  UPDATE public.memories
  SET title = 'Our Relationship Anniversary 💕',
      description = 'The day our story officially began...'
  WHERE couple_id = v_couple_id AND id = 44;

  UPDATE public.memories
  SET title = 'The Day We First Met ✨',
      description = 'The unforgettable moment our eyes met for the very first time...'
  WHERE couple_id = v_couple_id AND id = 43;

  -- 8. Meetings: Clear & Insert Well-Spaced London Meetings
  DELETE FROM public.meetings WHERE couple_id = v_couple_id;

  INSERT INTO public.meetings (couple_id, user_id, title, location_name, latitude, longitude, meeting_datetime, is_active)
  VALUES
    (
      v_couple_id, 
      v_user_male, 
      'Covent Garden Dinner & West End Show 🎭', 
      'Covent Garden, London', 
      51.5129, 
      -0.1243, 
      '2026-11-08 19:30:00+00', 
      true
    ),
    (
      v_couple_id, 
      v_user_female, 
      'Little Venice Canal Walk & Brunch 🥐', 
      'Little Venice, London', 
      51.5226, 
      -0.1834, 
      '2026-11-15 11:30:00+00', 
      true
    ),
    (
      v_couple_id, 
      v_user_male, 
      'Sunset Walk & Coffee by the Pagoda 🌅', 
      'Battersea Park, London', 
      51.4791, 
      -0.1567, 
      '2026-11-22 16:00:00+00', 
      true
    );

  -- 9. Map Notes: Clear & Insert Well-Spaced London Map Notes
  DELETE FROM public.map_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.map_notes (couple_id, user_id, latitude, longitude, note, created_at)
  VALUES
    (
      v_couple_id, 
      v_user_male, 
      51.5392, 
      -0.1607, 
      'The view of the London skyline was breathtaking, but I could only look at you 💫 (Primrose Hill)', 
      '2026-10-20 18:30:00+00'
    ),
    (
      v_couple_id, 
      v_user_female, 
      51.4769, 
      0.0005, 
      'Standing on the Prime Meridian line together. Time literally began with you here ✨ (Greenwich)', 
      '2026-10-25 15:45:00+00'
    ),
    (
      v_couple_id, 
      v_user_male, 
      51.4428, 
      -0.2733, 
      'Our long autumn bicycle ride among the ancient oaks and wild deer 🦌 (Richmond Park)', 
      '2026-10-28 14:15:00+00'
    ),
    (
      v_couple_id, 
      v_user_female, 
      51.5365, 
      -0.0383, 
      'Sunday morning market, fresh pastries and holding hands in the breeze 🌿 (Victoria Park)', 
      '2026-11-01 11:00:00+00'
    );

  -- 10. Photo Archive: Keep Existing Storage Paths & Update Location / Captions across London
  UPDATE public.photo_archive
  SET title = 'Sunset by Tower Bridge',
      description = 'Watching the golden sky reflect on the Thames as the city lights turned on 🌅',
      location_name = 'Tower Bridge, London',
      latitude = 51.5055,
      longitude = -0.0754,
      taken_date = '2026-10-18'
  WHERE couple_id = v_couple_id AND id = 'c6342ba9-3d05-45dd-b818-1f6ddf17ce27';

  UPDATE public.photo_archive
  SET title = 'Afternoon Picnic in Hyde Park',
      description = 'Strawberries, vintage picnic blanket, and endless laughter under the trees 🧺',
      location_name = 'Hyde Park, London',
      latitude = 51.5073,
      longitude = -0.1696,
      taken_date = '2026-10-22'
  WHERE couple_id = v_couple_id AND id = 'ff0aae0d-ee6a-4d80-a313-da40394c3f36';

  UPDATE public.photo_archive
  SET title = 'Rainy Afternoon in Notting Hill',
      description = 'Heart-shaped foam on our flat whites while the rain tapped on the window ☕',
      location_name = 'Notting Hill, London',
      latitude = 51.5173,
      longitude = -0.2057,
      taken_date = '2026-10-26'
  WHERE couple_id = v_couple_id AND id = 'b07878b7-18ea-48ff-a2f4-6d5227979516';

  UPDATE public.photo_archive
  SET title = 'Greenhouse Date at Kew Gardens',
      description = 'Surrounded by exotic palm trees and orchids on a crisp sunny day 🌿',
      location_name = 'Kew Gardens, London',
      latitude = 51.4787,
      longitude = -0.2956,
      taken_date = '2026-10-29'
  WHERE couple_id = v_couple_id AND id = '59d41a6d-16ee-44a5-852d-ccada8adc716';

  UPDATE public.photo_archive
  SET title = 'Our 1st Anniversary Dinner',
      description = 'Candlelight, warm smiles, and celebrating 365 days of loving each other 🌷',
      location_name = 'Mayfair, London',
      latitude = 51.5095,
      longitude = -0.1485,
      taken_date = '2026-10-30'
  WHERE couple_id = v_couple_id AND id = 'ee417afc-3681-4907-a4ce-d84574d9e6d1';

  UPDATE public.photo_archive
  SET title = 'Parliament Hill View at Hampstead',
      description = 'Looking across the entire city from the top of the hill wrapped in your coat 🍂',
      location_name = 'Hampstead Heath, London',
      latitude = 51.5606,
      longitude = -0.1631,
      taken_date = '2026-11-03'
  WHERE couple_id = v_couple_id AND id = '4c3d1111-ca66-497d-a0ad-d7cc9de642ea';

  UPDATE public.photo_archive
  SET title = 'Homemade Pasta Night',
      description = 'Flour on our noses and the kitchen was a mess, but the pasta was delicious 🍝'
  WHERE couple_id = v_couple_id AND id = 'b6a6e14a-2ffd-486f-b257-0ba5e5ec3d20';

  UPDATE public.photo_archive
  SET title = 'Cozy Movie Night In',
      description = 'Popcorn, warm blankets, and our favorite movie on a Friday night 🎬'
  WHERE couple_id = v_couple_id AND id = 'c2eada4e-cd48-4bcb-ba37-7b4e2d9fd9ab';

  UPDATE public.photo_archive
  SET title = 'Golden Autumn Leaves',
      description = 'Crisp autumn morning holding warm cups of coffee 🍂'
  WHERE couple_id = v_couple_id AND id = 'bde537c5-4f95-4ed6-93ae-d03bbdaea121';

  UPDATE public.photo_archive
  SET title = 'Vintage Bookstore Stroll',
      description = 'Getting lost together among tall bookshelves and old poems 📚'
  WHERE couple_id = v_couple_id AND id = 'd0263b6d-22a2-46bf-97eb-abf98d43fd87';

  UPDATE public.photo_archive
  SET title = 'Tea & Scones in Soho',
      description = 'Sharing the last strawberry jam scone with you 🫖'
  WHERE couple_id = v_couple_id AND id = 'c5130893-c44a-445b-b142-24516b102056';

  UPDATE public.photo_archive
  SET title = 'Stargazing Under the Night Sky',
      description = 'Counting shooting stars and making wishes together ✨'
  WHERE couple_id = v_couple_id AND id = '48883a96-612e-45f7-856c-78bce6c881ed';

  UPDATE public.photo_archive
  SET title = 'First Winter Snow Walk',
      description = 'Holding hands as snowflakes landed softly on your hair ❄️'
  WHERE couple_id = v_couple_id AND id = '988e9c4e-805c-4380-b0e5-9f8f8cbe8422';

END $$;

COMMIT;


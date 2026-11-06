-- ==============================================================================
-- MARKETING EN MOCK DATA FOR COUPLE ID 132 (Adjusted Spread across Europe)
-- - UK Photo moved to the very top (Scottish Highlands / North of Britain)
-- - One photo moved to Sweden (Stockholm)
-- - Meetings in France/Alps area reduced to 1 (Lucerne, Switzerland)
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_couple_id INT := 132;
  v_user_male UUID := '7ddd0c70-cd45-4236-93cd-bd5925a38b54'::uuid;
  v_user_female UUID := 'b9be438f-7b12-49f5-9237-f3e40f223c70'::uuid;
BEGIN

  -- 1. Meetings: Reduced to exactly 1 in Central Europe/Alps (Lucerne, Switzerland)
  DELETE FROM public.meetings WHERE couple_id = v_couple_id;

  INSERT INTO public.meetings (couple_id, user_id, title, location_name, latitude, longitude, meeting_datetime, is_active)
  VALUES
    (
      v_couple_id, 
      v_user_male, 
      'Scenic Alpine Lake Cruise 🏔️', 
      'Lucerne, Switzerland', 
      47.0502, 
      8.3093, 
      '2026-11-20 14:00:00+00', 
      true
    );

  -- 2. Map Notes: Cleanly isolated in 4 different corners
  DELETE FROM public.map_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.map_notes (couple_id, user_id, latitude, longitude, note, created_at)
  VALUES
    (
      v_couple_id, 
      v_user_female, 
      38.7115, 
      -9.1306, 
      'Riding Tram 28 up the cobblestone hills of Alfama with you 🚋 (Lisbon, Portugal)', 
      '2026-10-15 14:00:00+00'
    ),
    (
      v_couple_id, 
      v_user_male, 
      53.3498, 
      -6.2603, 
      'Cozy afternoon listening to live acoustic folk music in Temple Bar 🎻 (Dublin, Ireland)', 
      '2026-10-21 16:30:00+00'
    ),
    (
      v_couple_id, 
      v_user_male, 
      50.0865, 
      14.4114, 
      'Sunrise walk across Charles Bridge before the city woke up 🏰 (Prague, Czechia)', 
      '2026-10-24 07:30:00+00'
    ),
    (
      v_couple_id, 
      v_user_female, 
      55.6795, 
      12.5910, 
      'Colorful Nyhavn harbor and our favorite warm cinnamon rolls 🥐 (Copenhagen, Denmark)', 
      '2026-11-01 10:30:00+00'
    );

  -- 3. Photo Archive:
  -- UK photo moved to very top (Scottish Highlands: 56.5000, -4.2000)
  -- Sweden photo (Stockholm: 59.3293, 18.0686)
  -- Paris (France: 48.8584, 2.2945)
  -- Barcelona (Spain: 41.3851, 2.1734)
  -- Rome (Italy: 41.9009, 12.4833)
  -- Santorini (Greece: 36.4618, 25.3753)

  UPDATE public.photo_archive
  SET title = 'Autumn by the Eiffel Tower',
      description = 'Walking along the Seine holding warm croissants and your hand 🗼',
      location_name = 'Paris, France',
      latitude = 48.8584,
      longitude = 2.2945,
      taken_date = '2026-10-18'
  WHERE couple_id = v_couple_id AND id = 'c6342ba9-3d05-45dd-b818-1f6ddf17ce27';

  UPDATE public.photo_archive
  SET title = 'Scottish Highlands Road Trip',
      description = 'Rolling green hills, misty lochs, and holding hands in the cool autumn breeze 🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      location_name = 'Scottish Highlands, United Kingdom',
      latitude = 56.5000,
      longitude = -4.2000,
      taken_date = '2026-10-22'
  WHERE couple_id = v_couple_id AND id = 'ff0aae0d-ee6a-4d80-a313-da40394c3f36';

  UPDATE public.photo_archive
  SET title = 'Stockholm Gamla Stan & Waterfront',
      description = 'Walking through the historic cobblestone alleys of Gamla Stan and watching the sunset by the water 🇸🇪',
      location_name = 'Stockholm, Sweden',
      latitude = 59.3293,
      longitude = 18.0686,
      taken_date = '2026-10-26'
  WHERE couple_id = v_couple_id AND id = 'b07878b7-18ea-48ff-a2f4-6d5227979516';

  UPDATE public.photo_archive
  SET title = 'Sunset at Barceloneta Beach',
      description = 'Warm Mediterranean breeze, tapas, and the sound of waves 🌊',
      location_name = 'Barcelona, Spain',
      latitude = 41.3851,
      longitude = 2.1734,
      taken_date = '2026-10-29'
  WHERE couple_id = v_couple_id AND id = '59d41a6d-16ee-44a5-852d-ccada8adc716';

  UPDATE public.photo_archive
  SET title = 'Trevi Fountain Coin Toss',
      description = 'Tossing a coin over our shoulders and wishing for a lifetime together ✨',
      location_name = 'Rome, Italy',
      latitude = 41.9009,
      longitude = 12.4833,
      taken_date = '2026-10-30'
  WHERE couple_id = v_couple_id AND id = 'ee417afc-3681-4907-a4ce-d84574d9e6d1';

  UPDATE public.photo_archive
  SET title = 'Oia Sunset Over the Caldera',
      description = 'White-washed rooftops, deep blue Aegean waters, and you in my arms 🌅',
      location_name = 'Santorini, Greece',
      latitude = 36.4618,
      longitude = 25.3753,
      taken_date = '2026-11-03'
  WHERE couple_id = v_couple_id AND id = '4c3d1111-ca66-497d-a0ad-d7cc9de642ea';

  -- 4. Calendar Notes: Align with updated European spots
  DELETE FROM public.calendar_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.calendar_notes (couple_id, user_id, date, note)
  VALUES
    (v_couple_id, v_user_male, '2026-10-30', 'Our 1st Anniversary Dinner in Rome 🥂'),
    (v_couple_id, v_user_female, '2026-11-04', 'Flight to Stockholm ✈️'),
    (v_couple_id, v_user_male, '2026-11-08', 'Weekend Getaway in Prague 🏰'),
    (v_couple_id, v_user_male, '2026-11-20', 'Swiss Alps & Lake Lucerne Cruise 🏔️');

END $$;

COMMIT;


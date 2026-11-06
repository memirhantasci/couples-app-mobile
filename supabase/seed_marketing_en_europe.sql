-- ==============================================================================
-- MARKETING EN MOCK DATA FOR COUPLE ID 132 (Pan-European Spread for Love Map)
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_couple_id INT := 132;
  v_user_male UUID := '7ddd0c70-cd45-4236-93cd-bd5925a38b54'::uuid;
  v_user_female UUID := 'b9be438f-7b12-49f5-9237-f3e40f223c70'::uuid;
BEGIN

  -- 1. Calendar Notes: European Trips & Dates
  DELETE FROM public.calendar_notes WHERE couple_id = v_couple_id;

  INSERT INTO public.calendar_notes (couple_id, user_id, date, note)
  VALUES
    (v_couple_id, v_user_male, '2026-10-30', 'Our 1st Anniversary Dinner in Rome 🥂'),
    (v_couple_id, v_user_female, '2026-11-04', 'Flight to Vienna ✈️'),
    (v_couple_id, v_user_male, '2026-11-08', 'Weekend Getaway in Prague 🏰'),
    (v_couple_id, v_user_female, '2026-11-12', 'Gondola Date in Venice 🚣'),
    (v_couple_id, v_user_female, '2026-11-18', 'Vienna Opera Night 🎻'),
    (v_couple_id, v_user_male, '2026-11-25', 'Swiss Alps & Lake Lucerne 🏔️');

  -- 2. Memories: European Titles
  UPDATE public.memories
  SET title = 'Our 1st Anniversary in Rome 🌷',
      description = 'Celebrated our very first year together under candlelight near the Colosseum. So grateful for us, so grateful for forever.'
  WHERE couple_id = v_couple_id AND id = 73;

  UPDATE public.memories
  SET title = 'End of Summer in Barcelona 🌊',
      description = 'Sitting by the ocean waves at sunset, talking about our dreams and our future together.'
  WHERE couple_id = v_couple_id AND id = 71;

  UPDATE public.memories
  SET title = 'Under the Starlit Sky in the Alps ✨',
      description = 'Camping outside our tent under the Milky Way in the Swiss Alps. Laughing together wondering which star is ours.'
  WHERE couple_id = v_couple_id AND id = 72;

  UPDATE public.memories
  SET title = 'Hot Air Balloons at Dawn 🎈',
      description = 'Woke up at dawn to watch hundreds of hot air balloons fill the morning sky. We held hands and made a secret wish.'
  WHERE couple_id = v_couple_id AND id = 70;

  UPDATE public.memories
  SET title = 'Our First Winter Snow ❄️',
      description = 'Walking for hours through the quiet falling snow. My hands were freezing, but my heart was never warmer.'
  WHERE couple_id = v_couple_id AND id = 69;

  -- 3. Meetings: Distributed across Europe (Venice, Vienna, Lucerne)
  DELETE FROM public.meetings WHERE couple_id = v_couple_id;

  INSERT INTO public.meetings (couple_id, user_id, title, location_name, latitude, longitude, meeting_datetime, is_active)
  VALUES
    (
      v_couple_id, 
      v_user_male, 
      'Gondola Ride through the Grand Canal 🚣', 
      'Venice, Italy', 
      45.4342, 
      12.3388, 
      '2026-11-12 16:00:00+00', 
      true
    ),
    (
      v_couple_id, 
      v_user_female, 
      'Classical Opera & Sacher Torte 🎻', 
      'Vienna, Austria', 
      48.2082, 
      16.3738, 
      '2026-11-18 19:30:00+00', 
      true
    ),
    (
      v_couple_id, 
      v_user_male, 
      'Scenic Alpine Lake Cruise 🏔️', 
      'Lucerne, Switzerland', 
      47.0502, 
      8.3093, 
      '2026-11-25 11:00:00+00', 
      true
    );

  -- 4. Map Notes: Distributed across Europe (Lisbon, Prague, Bavaria, Copenhagen)
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
      50.0865, 
      14.4114, 
      'Sunrise walk across Charles Bridge before the city woke up 🏰 (Prague, Czechia)', 
      '2026-10-24 07:30:00+00'
    ),
    (
      v_couple_id, 
      v_user_female, 
      47.5576, 
      10.7498, 
      'Like a real-life fairy tale standing in front of the castle 👑 (Bavaria, Germany)', 
      '2026-10-27 15:00:00+00'
    ),
    (
      v_couple_id, 
      v_user_male, 
      55.6795, 
      12.5910, 
      'Colorful Nyhavn harbor and our favorite warm cinnamon rolls 🥐 (Copenhagen, Denmark)', 
      '2026-11-01 10:30:00+00'
    );

  -- 5. Photo Archive: Distributed across Europe (Paris, London, Amsterdam, Barcelona, Rome, Santorini)
  UPDATE public.photo_archive
  SET title = 'Autumn by the Eiffel Tower',
      description = 'Walking along the Seine holding warm croissants and your hand 🗼',
      location_name = 'Paris, France',
      latitude = 48.8584,
      longitude = 2.2945,
      taken_date = '2026-10-18'
  WHERE couple_id = v_couple_id AND id = 'c6342ba9-3d05-45dd-b818-1f6ddf17ce27';

  UPDATE public.photo_archive
  SET title = 'Sunset by Tower Bridge',
      description = 'Watching the golden sky reflect on the Thames as the city lights turned on 🌉',
      location_name = 'London, United Kingdom',
      latitude = 51.5055,
      longitude = -0.0754,
      taken_date = '2026-10-22'
  WHERE couple_id = v_couple_id AND id = 'ff0aae0d-ee6a-4d80-a313-da40394c3f36';

  UPDATE public.photo_archive
  SET title = 'Canal Bicycle Date',
      description = 'Renting bikes and riding along the historic canals in the morning sun 🚲',
      location_name = 'Amsterdam, Netherlands',
      latitude = 52.3676,
      longitude = 4.9041,
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

END $$;

COMMIT;


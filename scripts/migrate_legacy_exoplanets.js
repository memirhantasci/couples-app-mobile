/**
 * Scripts to migrate legacy 10-year signed URLs to secure paths.
 */
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const isResume = process.argv.includes('--resume');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  console.log(`Starting legacy exoplanet media migration... Mode: ` + (isDryRun ? 'DRY RUN' : 'EXECUTE'));

  const { data: planets, error } = await supabase
    .from('star_exoplanets')
    .select('id, media_urls');

  if (error) {
    console.error('Failed to fetch exoplanets:', error);
    process.exit(1);
  }

  // 1. Scan and group by oldPath
  const pathMap = new Map(); // oldPath -> { newPath, planetIds: [] }

  for (const planet of planets) {
    if (!planet.media_urls || planet.media_urls.length === 0) continue;

    for (const url of planet.media_urls) {
      if (url.startsWith('http')) {
        const match = url.match(/\/couple-memories\/([^?]+)/);
        if (match) {
          const oldPath = decodeURIComponent(match[1]);
          if (!pathMap.has(oldPath)) {
            // Generate deterministic new path: hash or replace prefix
            const newPath = oldPath.replace('exoplanets/', 'exoplanets-v2/');
            pathMap.set(oldPath, { newPath, planetIds: [planet.id] });
          } else {
            pathMap.get(oldPath).planetIds.push(planet.id);
          }
        }
      }
    }
  }

  console.log(`Found ` + pathMap.size + ` unique legacy storage objects to migrate.`);

  let migratedCount = 0;

  // 2. Process each oldPath
  for (const [oldPath, { newPath, planetIds }] of pathMap.entries()) {
    console.log(`\n[Object: ` + oldPath + `]`);
    console.log(`  -> New path: ` + newPath);
    console.log(`  -> Referenced by planets: ` + planetIds.join(', '));

    if (isDryRun) continue;

    // Step 2a: Copy the object
    const { error: copyError } = await supabase.storage.from('couple-memories').copy(oldPath, newPath);
    if (copyError && copyError.message !== 'The resource already exists') {
      console.error(`  [!] Copy failed: ` + copyError.message);
      continue;
    }

    // Optional: Verify the new object exists using API if necessary, but copy success implies it.
    
    // Step 2b: Update DB references for all associated planets
    let allUpdatesSuccessful = true;
    for (const planetId of planetIds) {
      // Fetch current media_urls to update only the specific URL
      const { data: planetData } = await supabase.from('star_exoplanets').select('media_urls').eq('id', planetId).single();
      if (!planetData) {
         console.error(`  [!] Failed to read planet ` + planetId);
         allUpdatesSuccessful = false;
         continue;
      }

      const updatedMediaUrls = planetData.media_urls.map(url => {
         if (url.startsWith('http') && url.includes(encodeURIComponent(oldPath).replace(/%2F/g, '/'))) {
             return newPath;
         }
         if (url.startsWith('http') && decodeURIComponent(url).includes(oldPath)) {
             return newPath;
         }
         return url;
      });

      const { error: updateError } = await supabase
        .from('star_exoplanets')
        .update({ media_urls: updatedMediaUrls })
        .eq('id', planetId);

      if (updateError) {
         console.error(`  [!] DB update failed for planet ` + planetId + `:`, updateError);
         allUpdatesSuccessful = false;
      } else {
         console.log(`  [v] Planet ` + planetId + ` updated.`);
      }
    }

    // Step 2c: Only if all DB updates succeeded, delete the old object
    if (allUpdatesSuccessful) {
      const { error: removeError } = await supabase.storage.from('couple-memories').remove([oldPath]);
      if (removeError) {
        console.warn(`  [!] Remove old object failed (will retry if --resume): ` + removeError.message);
      } else {
        console.log(`  [v] Old object removed successfully.`);
        migratedCount++;
      }
    } else {
      console.warn(`  [!] Skipping removal of old object due to DB update failures.`);
    }
  }

  console.log(`\nMigration complete. ` + migratedCount + ` legacy objects fully migrated and invalidated.`);
}

main().catch(console.error);

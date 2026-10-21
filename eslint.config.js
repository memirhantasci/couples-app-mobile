// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions: Deno çalışma zamanı (npm: importları, Deno globalleri)
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);

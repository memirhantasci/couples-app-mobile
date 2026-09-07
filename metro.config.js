const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Windows üzerinde Metro'nun çok çekirdekli sistemlerde (12+ thread) aynı anda yüzlerce dosyayı
// ve metro-cache dosyasını açarak 'EMFILE: too many open files' hatası vermesini engellemek için
// worker sayısını sınırlandırıyoruz.
config.maxWorkers = process.platform === 'win32' ? Math.min(2, os.cpus().length) : os.cpus().length;

// Metro'nun yerel Android/iOS geçici derleme klasörlerini izleyip Windows'ta 'ENOENT: watch android/build/generated'
// gibi hatalar vermesini engellemek için bu klasörleri blockList'e ekliyoruz.
// Not: node_modules içindeki paketleri (örn. expo-symbols/build/android) engellememek için spesifik desenler kullanıyoruz.
const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

config.resolver.blockList = [
  ...existingBlockList,
  /^(?:.*[\\/])?android[\\/](?:build|\.gradle|app[\\/]build)(?:[\\/]|$)/,
  /^(?:.*[\\/])?ios[\\/](?:build|Pods)(?:[\\/]|$)/,
];

module.exports = config;

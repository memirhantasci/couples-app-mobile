const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Windows üzerinde Metro'nun çok çekirdekli sistemlerde (12+ thread) aynı anda yüzlerce dosyayı
// ve metro-cache dosyasını açarak 'EMFILE: too many open files' hatası vermesini engellemek için
// worker sayısını sınırlandırıyoruz.
config.maxWorkers = process.platform === 'win32' ? Math.min(2, os.cpus().length) : os.cpus().length;

// Metro'nun yerel android ve ios derleme klasörlerini (özellikle Windows'ta silinen/geçici build dizinlerini)
// izleyerek 'ENOENT: watch android/build/generated' hatası vermesini engellemek için blockList'e ekliyoruz.
const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [config.resolver.blockList].filter(Boolean);

config.resolver.blockList = [
  ...existingBlockList,
  /^(?:.*[\\/])?android(?=[\\/]|$)/,
  /^(?:.*[\\/])?ios(?=[\\/]|$)/,
];

module.exports = config;

const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Windows üzerinde Metro'nun çok çekirdekli sistemlerde (12+ thread) aynı anda yüzlerce dosyayı
// ve metro-cache dosyasını açarak 'EMFILE: too many open files' hatası vermesini engellemek için
// worker sayısını sınırlandırıyoruz.
config.maxWorkers = process.platform === 'win32' ? Math.min(2, os.cpus().length) : os.cpus().length;

module.exports = config;

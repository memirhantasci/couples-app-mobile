import { LocaleConfig } from "react-native-calendars";
import i18n, { DEFAULT_LANGUAGE, isAppLanguage } from "@/lib/i18n";

// react-native-calendars ay/gün adlarını kendi LocaleConfig'inden okur; dayjs'ten bağımsızdır
LocaleConfig.locales["tr"] = {
  monthNames: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  monthNamesShort: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
  dayNames: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
  dayNamesShort: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
  today: "Bugün",
};

LocaleConfig.locales["en"] = {
  monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  today: "Today",
};

function applyCalendarLocale(language: string | undefined) {
  LocaleConfig.defaultLocale = isAppLanguage(language) ? language : DEFAULT_LANGUAGE;
}

// Bu modülü içe aktaran takvim ekranları, dil değişince ay/gün adlarını da otomatik günceller
applyCalendarLocale(i18n.language);
i18n.on("languageChanged", applyCalendarLocale);

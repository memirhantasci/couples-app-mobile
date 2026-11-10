import type { WishlistCategory } from "@/lib/wishlist";

/**
 * Boş listede gösterilen hazır fikirler. Dokununca seçili dildeki metin normal bir madde olarak yazılır;
 * bu yüzden çeviri dosyasında değil burada durur (kayıt sonrası kullanıcının kendi metni gibi davranır).
 */
interface WishlistIdeaSource {
  key: string;
  category: WishlistCategory;
  tr: string;
  en: string;
}

// Her kategoriden en az bir fikir; kliş ve birbirine benzeyen maddeler yok. Metinler kısa tutulur (çip 2 satıra sığmalı).
const IDEAS: readonly WishlistIdeaSource[] = [
  { key: "new-neighbourhood", category: "place", tr: "Hiç gitmediğimiz bir mahallede kaybolmak", en: "Get lost in a neighbourhood we've never visited" },
  { key: "stargazing", category: "place", tr: "Şehirden uzakta yıldız izlemek", en: "Stargaze far from the city lights" },
  { key: "pick-a-film", category: "film", tr: "Birbirimize birer film seçip izlemek", en: "Each pick a film for the other to watch" },
  { key: "series", category: "film", tr: "Birlikte bir diziyi bitirmek", en: "Finish a series together" },
  { key: "new-dish", category: "food", tr: "Hiç yapmadığımız bir yemeği birlikte pişirmek", en: "Cook a dish neither of us has made before" },
  { key: "sunrise", category: "experience", tr: "Gün doğumunu birlikte izlemek", en: "Watch a sunrise together" },
  { key: "dance", category: "experience", tr: "Birlikte dans dersine gitmek", en: "Take a dance class together" },
  { key: "weekend-trip", category: "travel", tr: "Plansız bir hafta sonu kaçamağı", en: "An unplanned weekend getaway" },
  { key: "train-trip", category: "travel", tr: "Hiç görmediğimiz bir şehre trenle gitmek", en: "Take a train to a city we've never seen" },
  { key: "memory-box", category: "other", tr: "Birbirimize bir anı kutusu hazırlamak", en: "Make each other a memory box" },
];

export interface WishlistIdea {
  key: string;
  category: WishlistCategory;
  title: string;
}

export function getWishlistIdeas(language: string): WishlistIdea[] {
  const useTurkish = language === "tr";
  return IDEAS.map(({ key, category, tr, en }) => ({ key, category, title: useTurkish ? tr : en }));
}

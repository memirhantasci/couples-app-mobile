/**
 * Development-only performance HUD for the macro sky map.
 *
 * Shows UI/JS thread frame rates and canvas metrics while the sky is open.
 * Kapalı: geliştirme build'lerinde de kullanıcıya/test edene sayılar görünmesin. Performans
 * ölçerken geçici olarak `__DEV__` yap; üretim paketinde `__DEV__` zaten false olduğu için hiç çizilmez.
 */
export const SKY_DEBUG_HUD_ENABLED = false;

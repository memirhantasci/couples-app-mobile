/**
 * Development-only performance HUD for the macro sky map.
 *
 * Shows UI/JS thread frame rates and canvas metrics while the sky is open.
 * Set this to `false` to hide the HUD in development builds; it never renders
 * in production bundles because `__DEV__` is false there.
 */
export const SKY_DEBUG_HUD_ENABLED = __DEV__;

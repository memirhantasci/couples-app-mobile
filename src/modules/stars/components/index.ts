/**
 * @file index.ts
 * @module modules/stars/components
 * @description "Bizim Yıldızımız" Modülü UI/UX Bileşenleri Dışa Aktarım Noktası
 */

export { StarInfoBadge } from './StarInfoBadge';
export type { StarInfoBadgeProps } from './StarInfoBadge';

export { ClaimStarModal } from './ClaimStarModal';
export type { ClaimStarModalProps, ClaimModalState } from './ClaimStarModal';

export { ExoplanetModal, PLANET_TYPE_OPTIONS, ORBIT_ZONE_OPTIONS } from './ExoplanetModal';
export type { ExoplanetModalProps, PlanetTypeOption } from './ExoplanetModal';

export { OurStarScreen } from './OurStarScreen';

export type PremiumFeatureSource =
  | 'general'
  | 'star_claim'
  | 'star_connect'
  | 'star_rename'
  | 'exoplanet_create'
  | 'exoplanet_view'
  | 'exoplanet_auto'
  | 'avatar';

export interface PremiumPaywallProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly featureSource?: PremiumFeatureSource;
}

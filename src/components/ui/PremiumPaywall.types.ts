export type PremiumFeatureSource =
  | 'general'
  | 'star_claim'
  | 'exoplanet_create'
  | 'exoplanet_view'
  | 'exoplanet_auto';

export interface PremiumPaywallProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly featureSource?: PremiumFeatureSource;
}

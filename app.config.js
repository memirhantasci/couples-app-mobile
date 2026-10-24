export default ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      }
    },
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile,
      config: {
        ...config.android?.config,
        googleMaps: {
          ...config.android?.config?.googleMaps,
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        }
      }
    },
    extra: {
      ...config.extra,
    }
  };
};

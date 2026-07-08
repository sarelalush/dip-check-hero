const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidRtl(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (application?.$) {
      // Layout direction is handled manually in React Native so Android does
      // not mirror the already-RTL screen composition differently from web.
      application.$['android:supportsRtl'] = 'false';
    }
    return modConfig;
  });

  return config;
};

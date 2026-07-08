const { withAndroidManifest, withMainApplication } = require('@expo/config-plugins');

function addKotlinRtl(contents) {
  let next = contents;

  if (!next.includes('com.facebook.react.modules.i18nmanager.I18nUtil')) {
    next = next.replace(
      /(import com\.facebook\.react\.ReactApplication\n)/,
      '$1import com.facebook.react.modules.i18nmanager.I18nUtil\n',
    );
  }

  if (!next.includes('I18nUtil.getInstance().forceRTL(this, true)')) {
    next = next.replace(
      /(super\.onCreate\(\)\n)/,
      '$1    I18nUtil.getInstance().allowRTL(this, true)\n    I18nUtil.getInstance().forceRTL(this, true)\n',
    );
  }

  return next;
}

function addJavaRtl(contents) {
  let next = contents;

  if (!next.includes('com.facebook.react.modules.i18nmanager.I18nUtil')) {
    next = next.replace(
      /(import com\.facebook\.react\.ReactApplication;\n)/,
      '$1import com.facebook.react.modules.i18nmanager.I18nUtil;\n',
    );
  }

  if (!next.includes('I18nUtil.getInstance().forceRTL(this, true);')) {
    next = next.replace(
      /(super\.onCreate\(\);\n)/,
      '$1    I18nUtil.getInstance().allowRTL(this, true);\n    I18nUtil.getInstance().forceRTL(this, true);\n',
    );
  }

  return next;
}

module.exports = function withAndroidRtl(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (application?.$) {
      application.$['android:supportsRtl'] = 'true';
    }
    return modConfig;
  });

  return withMainApplication(config, (modConfig) => {
    const language = modConfig.modResults.language;
    if (language === 'kt') {
      modConfig.modResults.contents = addKotlinRtl(modConfig.modResults.contents);
    } else if (language === 'java') {
      modConfig.modResults.contents = addJavaRtl(modConfig.modResults.contents);
    }
    return modConfig;
  });
};

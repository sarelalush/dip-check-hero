const { registerRootComponent } = require('expo');
const { I18nManager, Platform } = require('react-native');

// The app uses explicit RTL text alignment and row-reverse layouts.
// Do not force native RTL mirroring here, because Android would flip the
// already-polished layout and make it differ from the web preview.
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);
if (Platform.OS !== 'web' && typeof I18nManager.swapLeftAndRightInRTL === 'function') {
  I18nManager.swapLeftAndRightInRTL(false);
}

const App = require('./App').default;

registerRootComponent(App);

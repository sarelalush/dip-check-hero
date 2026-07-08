const { registerRootComponent } = require('expo');
const { I18nManager, Platform } = require('react-native');

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);
if (Platform.OS !== 'web' && typeof I18nManager.swapLeftAndRightInRTL === 'function') {
  I18nManager.swapLeftAndRightInRTL(true);
}

const App = require('./App').default;

registerRootComponent(App);

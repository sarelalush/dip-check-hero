const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const deviceProfiles = [
  { name: 'Small Android', width: 360, height: 640 },
  { name: 'Pixel 4a', width: 393, height: 851 },
  { name: 'Pixel 8', width: 412, height: 915 },
  { name: 'Galaxy S24 Ultra', width: 480, height: 1067 },
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 15', width: 393, height: 852 },
  { name: 'iPhone 15 Pro Max', width: 430, height: 932 },
];

const requiredScreens = [
  'HomeScreen.tsx',
  'PoolsScreen.tsx',
  'PoolDetailsScreen.tsx',
  'AddPoolScreen.tsx',
  'EditPoolScreen.tsx',
  'SelectPoolScreen.tsx',
  'SelectStripScreen.tsx',
  'ScanScreen.tsx',
  'ConfirmScanScreen.tsx',
  'ResultsScreen.tsx',
  'HistoryScreen.tsx',
  'SettingsScreen.tsx',
  'PlanUsageScreen.tsx',
  'ForgotPasswordScreen.tsx',
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function fail(message) {
  console.error(`\nMobile readiness failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

const appJson = JSON.parse(read('app.json'));
const appTsx = read('App.tsx');
const indexJs = read('index.js');
const theme = read('src/theme.ts');
const appShell = read('src/components/AppShell.tsx');
const webPhoneFrame = read('src/components/WebPhoneFrame.tsx');
const authScreenShell = read('src/components/AuthScreenShell.tsx');
const androidRtlPlugin = read('plugins/withAndroidRtl.js');
const supabaseClient = read('src/integrations/supabase/client.ts');
const stripAnalysisService = read('src/services/stripAnalysisService.ts');
const packageJson = JSON.parse(read('package.json'));

assert(appJson.expo.android?.package === 'com.stickcheck.app', 'Android package must stay com.stickcheck.app.');
assert(appJson.expo.extra?.eas?.projectId, 'EAS project id is missing.');
assert(appJson.expo.plugins?.includes('./plugins/withAndroidRtl'), 'Android layout-direction config plugin must stay enabled for release builds.');

assert(!appTsx.includes('I18nManager.forceRTL(true)'), 'App must not force native RTL mirroring; layout is manually RTL.');
assert(!indexJs.includes('I18nManager.forceRTL(true)'), 'index.js must not force native RTL mirroring before App is loaded.');
assert(indexJs.includes('I18nManager.forceRTL(false)') && indexJs.indexOf('I18nManager.forceRTL(false)') < indexJs.indexOf("require('./App')"), 'Native RTL mirroring must be disabled before App is loaded.');
assert(indexJs.includes('I18nManager.swapLeftAndRightInRTL(false)'), 'Native left/right swapping must stay disabled so Android matches web.');
assert(!appTsx.includes("direction: 'rtl'"), 'Root app wrapper must not force native/web RTL mirroring.');
assert(!appTsx.includes("direction: 'ltr'"), 'Root app wrapper should avoid direction style; layout stays structural LTR by default.');
assert(androidRtlPlugin.includes("android:supportsRtl'] = 'false'"), 'Android manifest must avoid native layout mirroring.');
assert(!androidRtlPlugin.includes('I18nUtil.getInstance().forceRTL'), 'Android native startup must not force RTL mirroring.');
assert(theme.includes("writingDirection: 'rtl'"), 'Theme RTL helper must include writingDirection rtl.');
assert(theme.includes("textAlign: 'right'"), 'Theme RTL helper must include right text alignment.');
assert(
  !supabaseClient.includes('const expoEnv') && supabaseClient.includes('process.env.EXPO_PUBLIC_SUPABASE_URL'),
  'Supabase env vars must use direct process.env.EXPO_PUBLIC_* access for Expo native builds.',
);
assert(
  !stripAnalysisService.includes('const expoEnv') && stripAnalysisService.includes('process.env.EXPO_PUBLIC_STRIP_ANALYSIS_MODE'),
  'Analysis env vars must use direct process.env.EXPO_PUBLIC_* access for Expo native builds.',
);

assert(appShell.includes('SafeAreaView'), 'AppShell must use SafeAreaView.');
assert(appShell.includes('ScrollView'), 'AppShell must support scrolling for smaller screens.');
assert(appShell.includes('BottomTabBar'), 'AppShell must keep bottom tabs inside the shell.');
assert(webPhoneFrame.includes("Platform.OS !== 'web'"), 'WebPhoneFrame must bypass the iPhone frame on native devices.');
assert(
  /segmented:\s*\{[\s\S]*?flexDirection:\s*'row-reverse'/.test(authScreenShell),
  'Auth login/signup tabs must keep login on the right and signup on the left in RTL.',
);
assert(
  authScreenShell.indexOf('>התחברות<') < authScreenShell.indexOf('>הרשמה<'),
  'Auth segmented tabs should render login before signup so login appears on the right.',
);

for (const screen of requiredScreens) {
  const screenPath = path.join(root, 'src', 'screens', screen);
  assert(fs.existsSync(screenPath), `${screen} is missing.`);
  const source = fs.readFileSync(screenPath, 'utf8');
  const usesResponsiveShell =
    source.includes('<AppShell') ||
    source.includes('<WebPhoneFrame') ||
    source.includes('<AuthScreenShell') ||
    source.includes('<StaticInfoScreen');
  assert(usesResponsiveShell, `${screen} must render inside an approved mobile shell.`);
}

for (const profile of deviceProfiles) {
  assert(profile.width >= 320, `${profile.name} width is below the supported minimum.`);
  assert(profile.height >= 568, `${profile.name} height is below the supported minimum.`);
}

assert(packageJson.scripts.typecheck, 'typecheck script is missing.');

console.log('Mobile readiness checks passed.');
console.log(`Checked ${requiredScreens.length} screens across ${deviceProfiles.length} device profiles:`);
for (const profile of deviceProfiles) {
  console.log(`- ${profile.name}: ${profile.width}x${profile.height}`);
}

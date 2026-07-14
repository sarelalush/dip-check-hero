import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_600SemiBold,
  Heebo_700Bold,
  Heebo_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/heebo';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { HomeScreen } from './src/screens/HomeScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { PoolsScreen } from './src/screens/PoolsScreen';
import { PoolDetailsScreen } from './src/screens/PoolDetailsScreen';
import { AddPoolScreen } from './src/screens/AddPoolScreen';
import { EditPoolScreen } from './src/screens/EditPoolScreen';
import { ConfirmScanScreen } from './src/screens/ConfirmScanScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { SelectPoolScreen } from './src/screens/SelectPoolScreen';
import { SelectStripScreen } from './src/screens/SelectStripScreen';
import { LandingScreen } from './src/screens/LandingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PlanUsageScreen } from './src/screens/PlanUsageScreen';
import { PurchaseScreen } from './src/screens/PurchaseScreen';
import { RemindersScreen } from './src/screens/RemindersScreen';
import { PrivacyPolicyScreen } from './src/screens/PrivacyPolicyScreen';
import { TermsScreen } from './src/screens/TermsScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { DeleteAccountScreen } from './src/screens/DeleteAccountScreen';
import { colors } from './src/theme';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import { PoolsProvider, usePools } from './src/state/PoolsContext';
import { ResultsHistoryProvider } from './src/state/ResultsHistoryContext';
import { ScanSessionProvider } from './src/state/ScanSessionContext';
import { ReminderProvider } from './src/state/ReminderContext';
import { AppPreferencesProvider } from './src/state/AppPreferencesContext';
import { hasActiveSubscription } from './src/services/usageService';

export type RootStackParamList = {
  Home: undefined;
  Pools: undefined;
  PoolDetails: { poolId: string };
  EditPool: { poolId: string };
  SelectPool: undefined;
  SelectStrip: { poolId?: string } | undefined;
  Scan: { brandId?: string; poolId?: string } | undefined;
  ConfirmScan: { brandId?: string; poolId?: string; imageUri: string };
  Results: { brandId?: string; poolId?: string; imageUri?: string; imagePath?: string; imageUrl?: string; testId?: string } | undefined;
  History: undefined;
  PlanUsage: { reason?: 'poolQuota' | 'scanQuota' | 'subscriptionRequired' } | undefined;
  Purchase: { reason?: 'poolQuota' | 'scanQuota' | 'subscriptionRequired' } | undefined;
  Reminders: undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
  Support: undefined;
  DeleteAccount: undefined;
  ReleaseChecklist: undefined;

  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  Dashboard: undefined;
  PoolsList: undefined;
  AddPool: undefined;
  ScanPlaceholder: { brandId: string; poolId?: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
type SubscriptionGateStatus = 'active' | 'checking' | 'inactive' | 'idle';

export default function App() {
  const [fontWaitExpired, setFontWaitExpired] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
    Heebo_800ExtraBold,
    ...Feather.font,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || fontsLoaded || fontError) return undefined;
    const timeout = setTimeout(() => setFontWaitExpired(true), 3500);
    return () => clearTimeout(timeout);
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError && !fontWaitExpired) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.rtlRoot}>
      <AuthProvider>
        <PoolsProvider>
          <ReminderProvider>
            <AppPreferencesProvider>
              <ScanSessionProvider>
                <ResultsHistoryProvider>
                  <AppNavigator />
                </ResultsHistoryProvider>
              </ScanSessionProvider>
            </AppPreferencesProvider>
          </ReminderProvider>
        </PoolsProvider>
      </AuthProvider>
    </View>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

function AppNavigator() {
  const { accountId, loading, isAuthenticated, passwordRecoveryExpiresAt } = useAuth();
  const { hydrated: poolsHydrated } = usePools();
  const isPasswordRecovery = Boolean(passwordRecoveryExpiresAt);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionGateStatus>('idle');

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated || isPasswordRecovery) {
      setSubscriptionStatus('idle');
      return () => {
        cancelled = true;
      };
    }

    if (!accountId) {
      setSubscriptionStatus('inactive');
      return () => {
        cancelled = true;
      };
    }

    setSubscriptionStatus('checking');
    hasActiveSubscription(accountId)
      .then((active) => {
        if (!cancelled) setSubscriptionStatus(active ? 'active' : 'inactive');
      })
      .catch(() => {
        if (!cancelled) setSubscriptionStatus('inactive');
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, isAuthenticated, isPasswordRecovery]);

  const subscriptionRequired = isAuthenticated && !isPasswordRecovery && subscriptionStatus === 'inactive';
  const subscriptionChecking = isAuthenticated && !isPasswordRecovery && subscriptionStatus === 'checking';

  if (loading || subscriptionChecking || (isAuthenticated && !isPasswordRecovery && !subscriptionRequired && !poolsHydrated)) {
    return (
      <View style={styles.loadingScreen}>
        <LoadingScreen />
      </View>
    );
  }

  return (
    <NavigationContainer key={isPasswordRecovery ? 'recovery' : isAuthenticated ? (subscriptionRequired ? 'paywall' : 'app') : 'auth'}>
      <Stack.Navigator
        initialRouteName={isPasswordRecovery ? 'ResetPassword' : isAuthenticated ? (subscriptionRequired ? 'Purchase' : 'Home') : 'Welcome'}
        screenOptions={{ headerShown: false }}
      >
        {isPasswordRecovery ? (
          <>
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : isAuthenticated ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Pools" component={PoolsScreen} />
            <Stack.Screen name="PoolDetails" component={PoolDetailsScreen} />
            <Stack.Screen name="AddPool" component={AddPoolScreen} />
            <Stack.Screen name="EditPool" component={EditPoolScreen} />
            <Stack.Screen name="SelectPool" component={SelectPoolScreen} />
            <Stack.Screen name="SelectStrip" component={SelectStripScreen} />
            <Stack.Screen name="Scan" component={ScanScreen} />
            <Stack.Screen name="ConfirmScan" component={ConfirmScanScreen} />
            <Stack.Screen name="Results" component={ResultsScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="PlanUsage" component={PlanUsageScreen} />
            <Stack.Screen name="Purchase" component={PurchaseScreen} />
            <Stack.Screen name="Reminders" component={RemindersScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  rtlRoot: {
    flex: 1,
  },
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});

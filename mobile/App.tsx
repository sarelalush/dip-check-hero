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
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { HomeScreen } from './src/screens/HomeScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { PoolsScreen } from './src/screens/PoolsScreen';
import { PoolDetailsScreen } from './src/screens/PoolDetailsScreen';
import { AddPoolScreen } from './src/screens/AddPoolScreen';
import { EditPoolScreen } from './src/screens/EditPoolScreen';
import { ConfirmScanScreen } from './src/screens/ConfirmScanScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { SelectStripScreen } from './src/screens/SelectStripScreen';
import { LandingScreen } from './src/screens/LandingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OnboardingScreen, ONBOARDING_COMPLETE_KEY } from './src/screens/OnboardingScreen';
import { PlanUsageScreen } from './src/screens/PlanUsageScreen';
import { PrivacyPolicyScreen } from './src/screens/PrivacyPolicyScreen';
import { TermsScreen } from './src/screens/TermsScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { DeleteAccountScreen } from './src/screens/DeleteAccountScreen';
import { ReleaseChecklistScreen } from './src/screens/ReleaseChecklistScreen';
import { colors } from './src/theme';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import { PoolsProvider, usePools } from './src/state/PoolsContext';
import { ResultsHistoryProvider } from './src/state/ResultsHistoryContext';
import { ScanSessionProvider } from './src/state/ScanSessionContext';
import { ReminderProvider } from './src/state/ReminderContext';
import { AppPreferencesProvider } from './src/state/AppPreferencesContext';

export type RootStackParamList = {
  Home: undefined;
  Onboarding: undefined;
  Pools: undefined;
  PoolDetails: { poolId: string };
  EditPool: { poolId: string };
  SelectStrip: { poolId?: string } | undefined;
  Scan: { brandId?: string; poolId?: string } | undefined;
  ConfirmScan: { brandId?: string; poolId?: string; imageUri: string };
  Results: { brandId?: string; poolId?: string; imageUri?: string; imagePath?: string; imageUrl?: string; testId?: string } | undefined;
  History: undefined;
  PlanUsage: { reason?: 'poolQuota' | 'scanQuota' } | undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
  Support: undefined;
  DeleteAccount: undefined;
  ReleaseChecklist: undefined;

  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  Dashboard: undefined;
  PoolsList: undefined;
  AddPool: undefined;
  ScanPlaceholder: { brandId: string; poolId?: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
    Heebo_800ExtraBold,
    ...Feather.font,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
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
  );
}

function AppNavigator() {
  const { loading, isAuthenticated } = useAuth();
  const { hydrated: poolsHydrated, pools } = usePools();
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function restoreOnboarding() {
      try {
        const stored = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (!mounted) return;
        setOnboardingComplete(stored === 'true');
      } catch (error) {
        console.warn('Failed to restore onboarding state', error);
      } finally {
        if (mounted) setOnboardingLoaded(true);
      }
    }

    restoreOnboarding();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !poolsHydrated || pools.length === 0 || onboardingComplete) return;

    async function markCompleteAfterFirstPool() {
      try {
        await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      } catch (error) {
        console.warn('Failed to persist onboarding completion', error);
      }
      setOnboardingComplete(true);
    }

    markCompleteAfterFirstPool();
  }, [isAuthenticated, onboardingComplete, pools.length, poolsHydrated]);

  if (loading || (isAuthenticated && (!poolsHydrated || !onboardingLoaded))) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer key={isAuthenticated ? 'app' : 'auth'}>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? (pools.length === 0 && !onboardingComplete ? 'Onboarding' : 'Home') : 'Welcome'}
        screenOptions={{ headerShown: false }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Pools" component={PoolsScreen} />
            <Stack.Screen name="PoolDetails" component={PoolDetailsScreen} />
            <Stack.Screen name="AddPool" component={AddPoolScreen} />
            <Stack.Screen name="EditPool" component={EditPoolScreen} />
            <Stack.Screen name="SelectStrip" component={SelectStripScreen} />
            <Stack.Screen name="Scan" component={ScanScreen} />
            <Stack.Screen name="ConfirmScan" component={ConfirmScanScreen} />
            <Stack.Screen name="Results" component={ResultsScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="PlanUsage" component={PlanUsageScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="Support" component={SupportScreen} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
            <Stack.Screen name="ReleaseChecklist" component={ReleaseChecklistScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});

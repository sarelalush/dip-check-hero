import { useEffect, useState } from 'react';
import { ActivityIndicator, I18nManager, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { SelectStripScreen } from './src/screens/SelectStripScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { PlaceholderScreen } from './src/screens/PlaceholderScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { colors } from './src/theme';

I18nManager.allowRTL(true);
I18nManager.forceRTL(false);

export type RootStackParamList = {
  Home: undefined;
  SelectStrip: undefined;
  Scan: { brandId: string };
  Pools: undefined;
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isSupabaseConfigured) {
    return <SetupScreen />;
  }

  if (!session?.user) {
    return <AuthScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="Home">
          {(props) => <HomeScreen {...props} user={session.user} />}
        </Stack.Screen>
        <Stack.Screen name="SelectStrip" component={SelectStripScreen} />
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="Pools">
          {() => <PlaceholderScreen title="הבריכות שלי" />}
        </Stack.Screen>
        <Stack.Screen name="History">
          {() => <PlaceholderScreen title="ההיסטוריה שלי" />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

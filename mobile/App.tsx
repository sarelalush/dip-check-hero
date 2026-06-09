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
import { PoolsProvider } from './src/state/PoolsContext';
import { ResultsHistoryProvider } from './src/state/ResultsHistoryContext';

export type RootStackParamList = {
  Home: undefined;
  Pools: undefined;
  PoolDetails: { poolId: string };
  EditPool: { poolId: string };
  SelectStrip: { poolId?: string } | undefined;
  Scan: { brandId?: string; poolId?: string } | undefined;
  ConfirmScan: { brandId?: string; poolId?: string; imageUri: string };
  Results: { brandId?: string; poolId?: string; imageUri?: string } | undefined;
  History: undefined;

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
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <PoolsProvider>
      <ResultsHistoryProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
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
          </Stack.Navigator>
        </NavigationContainer>
      </ResultsHistoryProvider>
    </PoolsProvider>
  );
}

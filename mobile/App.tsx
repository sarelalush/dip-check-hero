import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AddPoolScreen } from './src/screens/AddPoolScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LandingScreen } from './src/screens/LandingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { PoolDetailsScreen } from './src/screens/PoolDetailsScreen';
import { PoolsListScreen } from './src/screens/PoolsListScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { PoolsProvider } from './src/state/PoolsContext';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  Dashboard: undefined;
  PoolsList: undefined;
  AddPool: undefined;
  PoolDetails: { poolId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <PoolsProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Welcome" component={LandingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="PoolsList" component={PoolsListScreen} />
          <Stack.Screen name="AddPool" component={AddPoolScreen} />
          <Stack.Screen name="PoolDetails" component={PoolDetailsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PoolsProvider>
  );
}

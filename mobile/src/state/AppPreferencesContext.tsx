import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface AppPreferencesContextValue {
  hydrated: boolean;
  showTechnicalAnalysisDetails: boolean;
  setShowTechnicalAnalysisDetails: (value: boolean) => void;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);
const TECHNICAL_DETAILS_KEY = '@aquasense/preferences/show-technical-analysis';

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [showTechnicalAnalysisDetails, setShowTechnicalAnalysisDetailsState] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function restorePreferences() {
      try {
        const stored = await AsyncStorage.getItem(TECHNICAL_DETAILS_KEY);
        if (!mounted) return;
        setShowTechnicalAnalysisDetailsState(stored === null ? false : stored === 'true');
      } catch (error) {
        console.warn('Failed to restore app preferences', error);
      } finally {
        if (mounted) setHydrated(true);
      }
    }

    restorePreferences();

    return () => {
      mounted = false;
    };
  }, []);

  function setShowTechnicalAnalysisDetails(value: boolean) {
    setShowTechnicalAnalysisDetailsState(value);
    AsyncStorage.setItem(TECHNICAL_DETAILS_KEY, String(value)).catch((error) => {
      console.warn('Failed to save technical analysis preference', error);
    });
  }

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      hydrated,
      showTechnicalAnalysisDetails,
      setShowTechnicalAnalysisDetails,
    }),
    [hydrated, showTechnicalAnalysisDetails],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error('useAppPreferences must be used inside AppPreferencesProvider');
  }
  return context;
}

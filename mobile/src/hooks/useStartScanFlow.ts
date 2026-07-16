import { useCallback } from 'react';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../App';
import { getBrand } from '../config/stripBrands';
import { usePools } from '../state/PoolsContext';
import { useAuth } from '../state/AuthContext';
import { useScanSession } from '../state/ScanSessionContext';

export function useStartScanFlow(navigation: NavigationProp<RootStackParamList>) {
  const { getPool, pools } = usePools();
  const { accountId } = useAuth();
  const { startScanSession } = useScanSession();

  return useCallback(
    (poolId?: string) => {
      if (!accountId) {
        navigation.navigate('Purchase', { reason: 'subscriptionRequired' });
        return;
      }

      const explicitPool = poolId ? getPool(poolId) : undefined;
      const selectedPool = explicitPool ?? (pools.length === 1 ? pools[0] : undefined);

      if (selectedPool) {
        const poolBrand = selectedPool.stripBrandId ? getBrand(selectedPool.stripBrandId) : undefined;
        const canSkipStripSelection = Boolean(poolBrand?.supported);

        const scanBrandId = poolBrand?.id ?? selectedPool.stripBrandId;

        startScanSession({ brandId: canSkipStripSelection ? scanBrandId : selectedPool.stripBrandId, poolId: selectedPool.id });
        if (canSkipStripSelection && scanBrandId) {
          navigation.navigate('ScanPlaceholder', { poolId: selectedPool.id, brandId: scanBrandId });
        } else {
          navigation.navigate('SelectStrip', { poolId: selectedPool.id });
        }
        return;
      }

      if (pools.length === 0) {
        navigation.navigate('AddPool');
        return;
      }

      navigation.navigate('SelectPool');
    },
    [accountId, getPool, navigation, pools, startScanSession],
  );
}

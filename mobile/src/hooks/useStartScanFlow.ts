import { useCallback } from 'react';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../App';
import { usePools } from '../state/PoolsContext';
import { useScanSession } from '../state/ScanSessionContext';

export function useStartScanFlow(navigation: NavigationProp<RootStackParamList>) {
  const { getPool, pools } = usePools();
  const { startScanSession } = useScanSession();

  return useCallback(
    (poolId?: string) => {
      const explicitPool = poolId ? getPool(poolId) : undefined;
      const selectedPool = explicitPool ?? (pools.length === 1 ? pools[0] : undefined);

      if (selectedPool) {
        startScanSession({ brandId: selectedPool.stripBrandId, poolId: selectedPool.id });
        navigation.navigate('SelectStrip', { poolId: selectedPool.id });
        return;
      }

      if (pools.length === 0) {
        navigation.navigate('AddPool');
        return;
      }

      navigation.navigate('SelectPool');
    },
    [getPool, navigation, pools, startScanSession],
  );
}

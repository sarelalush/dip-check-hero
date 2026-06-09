// Source of truth migrated from web:
// src/utils/calculatePoolVolume.ts, src/utils/storage.ts, and src/routes/pool.new.tsx.

import { DEFAULT_BRAND_ID } from '../config/stripBrands';

export type PoolType = 'chlorine' | 'salt';
export type SanitizerType = PoolType;
export type PoolShape = 'rectangle' | 'round' | 'oval';
export type PoolVolumeEntryMethod = 'manual' | 'dimensions';
export type PoolVolumeUnit = 'liters' | 'cubic';

export interface VolumeInputRect {
  shape: 'rectangle';
  length: number;
  width: number;
  depth: number;
}

export interface VolumeInputRound {
  shape: 'round';
  diameter: number;
  depth: number;
}

export interface VolumeInputOval {
  shape: 'oval';
  length: number;
  width: number;
  depth: number;
}

export type VolumeInput = VolumeInputRect | VolumeInputRound | VolumeInputOval;

export interface PoolTreatmentSettings {
  tabletsActive: boolean;
  tabletsCount: number;
  tabletWeightGrams: number;
  pumpHoursPerDay: number;
  retestHours: number;
}

export interface PoolDimensions {
  shape: PoolShape;
  lengthMeters?: number;
  widthMeters?: number;
  diameterMeters?: number;
  averageDepthMeters?: number;
}

export interface Pool {
  id: string;
  cloudId?: string;
  name: string;
  type: PoolType;
  sanitizerType: SanitizerType;
  volumeLiters: number;
  volumeEntryMethod: PoolVolumeEntryMethod;
  volumeUnit?: PoolVolumeUnit;
  shape?: PoolShape;
  lengthMeters?: number;
  widthMeters?: number;
  diameterMeters?: number;
  averageDepthMeters?: number;
  stripBrandId?: string;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
  lastTestAt?: number;
  tabletsActive?: boolean;
  tabletsCount?: number;
  tabletWeightGrams?: number;
  pumpHoursPerDay?: number;
  retestHours?: number;
}

export type NewPoolInput = Omit<Pool, 'id' | 'createdAt' | 'updatedAt' | 'lastTestAt'> & {
  createdAt?: number;
};

export type UpdatePoolInput = Partial<NewPoolInput>;

export const DEFAULT_TREATMENT_SETTINGS: PoolTreatmentSettings = {
  tabletsActive: false,
  tabletsCount: 1,
  tabletWeightGrams: 200,
  pumpHoursPerDay: 8,
  retestHours: 6,
};

export function calculatePoolVolume(input: VolumeInput): number {
  if (input.depth <= 0) return 0;

  let cubicMeters = 0;
  if (input.shape === 'rectangle') {
    if (input.length <= 0 || input.width <= 0) return 0;
    cubicMeters = input.length * input.width * input.depth;
  } else if (input.shape === 'round') {
    if (input.diameter <= 0) return 0;
    const radius = input.diameter / 2;
    cubicMeters = radius * radius * Math.PI * input.depth;
  } else {
    if (input.length <= 0 || input.width <= 0) return 0;
    cubicMeters = input.length * input.width * input.depth * 0.785;
  }

  return Math.round(cubicMeters * 1000);
}

export function calculateManualVolumeLiters(value: number, unit: PoolVolumeUnit): number {
  if (value <= 0) return 0;
  return Math.round(unit === 'liters' ? value : value * 1000);
}

export function getPoolTypeLabel(type: PoolType): string {
  return type === 'salt' ? 'בריכת מלח' : 'כלור רגיל';
}

export function getPoolShapeLabel(shape?: PoolShape): string {
  if (shape === 'round') return 'עגולה';
  if (shape === 'oval') return 'אובלית';
  return 'מלבנית';
}

export function normalizePool(pool: Partial<Pool> & { id?: string; name?: string; createdAt?: number }): Pool {
  const now = Date.now();
  const createdAt = pool.createdAt ?? now;
  const type = pool.type ?? pool.sanitizerType ?? 'chlorine';
  const shape = pool.shape ?? 'rectangle';

  return {
    id: pool.id ?? `pool-${now}`,
    name: pool.name?.trim() || 'בריכה ללא שם',
    type,
    sanitizerType: pool.sanitizerType ?? type,
    volumeLiters: Math.max(0, Math.round(pool.volumeLiters ?? 0)),
    volumeEntryMethod: pool.volumeEntryMethod ?? 'dimensions',
    volumeUnit: pool.volumeUnit ?? 'liters',
    shape,
    lengthMeters: pool.lengthMeters,
    widthMeters: pool.widthMeters,
    diameterMeters: pool.diameterMeters,
    averageDepthMeters: pool.averageDepthMeters,
    stripBrandId: pool.stripBrandId ?? DEFAULT_BRAND_ID,
    notes: pool.notes,
    createdAt,
    updatedAt: pool.updatedAt ?? createdAt,
    lastTestAt: pool.lastTestAt,
    tabletsActive: pool.tabletsActive ?? DEFAULT_TREATMENT_SETTINGS.tabletsActive,
    tabletsCount: pool.tabletsCount ?? DEFAULT_TREATMENT_SETTINGS.tabletsCount,
    tabletWeightGrams: pool.tabletWeightGrams ?? DEFAULT_TREATMENT_SETTINGS.tabletWeightGrams,
    pumpHoursPerDay: pool.pumpHoursPerDay ?? DEFAULT_TREATMENT_SETTINGS.pumpHoursPerDay,
    retestHours: pool.retestHours ?? DEFAULT_TREATMENT_SETTINGS.retestHours,
  };
}

export function calculateRectangularVolumeLiters(
  lengthMeters: number,
  widthMeters: number,
  averageDepthMeters: number,
) {
  return calculatePoolVolume({
    shape: 'rectangle',
    length: lengthMeters,
    width: widthMeters,
    depth: averageDepthMeters,
  });
}

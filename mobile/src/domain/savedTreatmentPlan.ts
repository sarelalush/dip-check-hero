import { productConfig } from '../config/productConfig';
import type { DosageProduct } from './dosage';
import type { StripAnalysisResult } from './scanResults';
import { PARAM_LABEL_HE, type StripParameter } from './strip';
import { SHOCK_POLICY_VERSION, shockCalculation, type DpdShockSnapshot } from './chlorineShock';

// An instruction archive, separate from current eligibility to add a dose.
// Keep the original amount/volume; never recalculate a historical recipe using
// today's pool settings. Existing raw_result JSON stores this with the result.
export interface SavedTreatmentPlan {
  schemaVersion: 1;
  resultId: string;
  analyzedAt: number;
  proposedAt: number;
  poolId?: string;
  volumeLiters?: number;
  paramKey: StripParameter;
  labelHe: string;
  steps: string[];
  product?: DosageProduct;
  materialNote?: string;
  calculationNote?: string;
  prerequisiteHe?: string;
  policyVersion: string;
  // A separate, user-entered DPD measurement; never a reinterpretation of the photo.
  shock?: DpdShockSnapshot;
}

export function getSavedTreatmentPlan(result: StripAnalysisResult | undefined): SavedTreatmentPlan | undefined {
  const plan = result?.treatmentPlan;
  if (!plan || plan.schemaVersion !== 1 || plan.resultId !== result?.id ||
      plan.analyzedAt !== result.analyzedAt || !Number.isFinite(plan.proposedAt) ||
      typeof plan.paramKey !== 'string' || !Object.prototype.hasOwnProperty.call(PARAM_LABEL_HE, plan.paramKey) ||
      typeof plan.labelHe !== 'string' || typeof plan.policyVersion !== 'string' ||
      !Array.isArray(plan.steps) || plan.steps.length === 0 || plan.steps.length > 8 ||
      plan.steps.some(step => typeof step !== 'string' || !step.trim() || step.length > 2000)) return undefined;
  if (plan.volumeLiters !== undefined && (!Number.isFinite(plan.volumeLiters) || plan.volumeLiters <= 0)) return undefined;
  if ([plan.materialNote, plan.calculationNote, plan.prerequisiteHe].some(note => note !== undefined && typeof note !== 'string')) return undefined;
  if (plan.product && (!Object.prototype.hasOwnProperty.call(productConfig, plan.product.key) ||
      !Number.isFinite(plan.product.amount) || plan.product.amount <= 0 ||
      typeof plan.product.labelHe !== 'string' || typeof plan.product.unit !== 'string')) return undefined;
  if (plan.policyVersion === SHOCK_POLICY_VERSION && !plan.shock) return undefined;
  if (plan.shock) {
    const shock = plan.shock;
    const calculation = shockCalculation(shock, plan.volumeLiters ?? 0);
    if (shock.source !== 'manual-dpd' || shock.productAndEquipmentConfirmed !== true ||
        shock.disclosureVersion !== SHOCK_POLICY_VERSION || plan.policyVersion !== SHOCK_POLICY_VERSION ||
        plan.paramKey !== 'totalChlorine' || plan.product?.key !== 'chlorineLiquid10' ||
        plan.product.unit !== 'מ״ל' || plan.product.labelHe !== productConfig.chlorineLiquid10.labelHe ||
        plan.product.amount !== calculation.amountMl ||
        shock.targetFreeChlorine !== calculation.target || shock.measuredAt !== plan.proposedAt ||
        !plan.poolId) return undefined;
  }
  return plan;
}

export function treatmentPlanContentKey(plan: SavedTreatmentPlan): string {
  // JSONB may reorder object properties. Compare a fixed field order so a
  // cloud round trip cannot cause repeated writes of identical instructions.
  return JSON.stringify([plan.schemaVersion, plan.resultId, plan.analyzedAt,
    plan.poolId, plan.volumeLiters, plan.paramKey, plan.labelHe, plan.steps,
    plan.product ? [plan.product.key, plan.product.amount, plan.product.unit, plan.product.labelHe] : null,
    plan.materialNote, plan.calculationNote, plan.prerequisiteHe, plan.policyVersion,
    plan.shock ? [plan.shock.source, plan.shock.freeChlorine, plan.shock.totalChlorine,
      plan.shock.ph, plan.shock.cyanuricAcid, plan.shock.measuredAt, plan.shock.targetFreeChlorine,
      plan.shock.productAndEquipmentConfirmed, plan.shock.disclosureVersion] : null]);
}

// Results are scan-first. Legacy manual-DPD records remain stored for backwards
// compatibility, but cannot become scan-derived instructions or an input form.
export function getSavedScanTreatmentPlan(result: StripAnalysisResult | undefined): SavedTreatmentPlan | undefined {
  if (!result || result.accepted === false || result.isValidStrip === false || result.lowConfidence ||
      result.source === 'mock' || result.source === 'remote-mock' ||
      (result.failureReason && result.failureReason !== 'none')) return undefined;
  const plan = getSavedTreatmentPlan(result);
  if (!plan || plan.shock) return undefined;
  if (plan.product && (!plan.volumeLiters || !plan.poolId || plan.poolId !== result?.poolId)) return undefined;
  return plan;
}

import { describe, expect, it } from 'vitest';

import { selectAquachekProAiConsensus } from '../supabase/functions/_shared/aquachek-pro-ai-consensus.js';

describe('AquaChek Pro AI consensus', () => {
  it('accepts two matching independent chart readings', () => {
    const result = selectAquachekProAiConsensus([
      { totalChlorine: 0.5, freeChlorine: 3, ph: 7.8, alkalinity: 240 },
      { totalChlorine: 0.5, freeChlorine: 3, ph: 7.8, alkalinity: 240 },
    ]);

    expect(result.accepted).toBe(true);
    expect(result.values).toEqual({
      totalChlorine: 0.5,
      bromine: 1,
      freeChlorine: 3,
      ph: 7.8,
      alkalinity: 240,
    });
  });

  it('uses a third reading only to resolve an outlier', () => {
    const result = selectAquachekProAiConsensus([
      { totalChlorine: 1, freeChlorine: 0.5, ph: 7.2, alkalinity: 120 },
      { totalChlorine: 3, freeChlorine: 3, ph: 7.8, alkalinity: 180 },
      { totalChlorine: 1, freeChlorine: 0.5, ph: 7.2, alkalinity: 120 },
    ]);

    expect(result.accepted).toBe(true);
    expect(result.values).toEqual({
      totalChlorine: 1,
      bromine: 2,
      freeChlorine: 0.5,
      ph: 7.2,
      alkalinity: 120,
    });
  });

  it('snaps model estimates to official manufacturer levels', () => {
    const result = selectAquachekProAiConsensus([
      { totalChlorine: 0.55, freeChlorine: 2.9, ph: 7.75, alkalinity: 235 },
      { totalChlorine: 0.48, freeChlorine: 3.1, ph: 7.82, alkalinity: 242 },
    ]);

    expect(result.accepted).toBe(true);
    expect(result.values).toMatchObject({
      totalChlorine: 0.5,
      bromine: 1,
      freeChlorine: 3,
      ph: 7.8,
      alkalinity: 240,
    });
  });

  it('rejects when no two AI readings agree for every parameter', () => {
    const result = selectAquachekProAiConsensus([
      { totalChlorine: 0, freeChlorine: 0, ph: 6.2, alkalinity: 0 },
      { totalChlorine: 1, freeChlorine: 1, ph: 7.2, alkalinity: 80 },
      { totalChlorine: 5, freeChlorine: 5, ph: 8.4, alkalinity: 180 },
    ]);

    expect(result.accepted).toBe(false);
    expect(result.missingConsensus).toEqual([
      'totalChlorine',
      'freeChlorine',
      'ph',
      'alkalinity',
    ]);
  });

  it('derives bromine from the same combined-pad column as total chlorine', () => {
    const result = selectAquachekProAiConsensus([
      { totalChlorine: 10, bromine: 1, freeChlorine: 0, ph: 6.8, alkalinity: 40 },
      { totalChlorine: 10, bromine: 40, freeChlorine: 0, ph: 6.8, alkalinity: 40 },
    ]);

    expect(result.accepted).toBe(true);
    expect(result.values.bromine).toBe(20);
  });
});

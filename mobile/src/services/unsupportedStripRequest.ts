// Mobile placeholder for the web request flow in src/routes/select-strip.tsx.
// Supabase persistence is intentionally not connected yet.

export interface UnsupportedStripRequestDraft {
  id: string;
  brandName: string;
  notes?: string;
  createdAt: number;
  status: 'local-placeholder';
}

export function createUnsupportedStripRequestDraft(brandName: string, notes?: string): UnsupportedStripRequestDraft {
  return {
    id: `unsupported-strip-${Date.now()}`,
    brandName: brandName.trim(),
    notes: notes?.trim() || undefined,
    createdAt: Date.now(),
    status: 'local-placeholder',
  };
}

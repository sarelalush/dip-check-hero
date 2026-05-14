// In-memory store for the active scan flow (cleared on full reload — fine for MVP)
import type { StripResults } from "./analyzeStripImage";

interface Session {
  results?: StripResults;
  imageDataUrl?: string;
  /** Captured + isolated image awaiting user confirmation before AI analysis. */
  pendingImageDataUrl?: string;
  /** Raw captured image (before auto-isolation), used for manual adjustment. */
  rawImageDataUrl?: string;
  includeSalt?: boolean;
  brandId?: string;
}

let session: Session = {};

export const scanSession = {
  set(s: Session) { session = { ...session, ...s }; },
  get(): Session { return session; },
  clear() { session = {}; },
};

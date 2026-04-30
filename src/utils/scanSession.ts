// In-memory store for the active scan flow (cleared on full reload — fine for MVP)
import type { StripResults } from "./analyzeStripImage";

interface Session {
  results?: StripResults;
  imageDataUrl?: string;
  includeSalt?: boolean;
}

let session: Session = {};

export const scanSession = {
  set(s: Session) { session = { ...session, ...s }; },
  get(): Session { return session; },
  clear() { session = {}; },
};

import type { CostBreakdown, TelemetryProfile } from '../types';
import { zeroCostBreakdown } from './stub';

// TODO(stage-4): implement Honeycomb pricing (event-based, logs and spans both count as events).
export function calculateHoneycombCost(_profile: TelemetryProfile): CostBreakdown {
  return zeroCostBreakdown('honeycomb', ['Coming in Stage 4: Honeycomb pricing model not implemented yet.']);
}

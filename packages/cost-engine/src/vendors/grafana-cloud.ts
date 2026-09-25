import type { CostBreakdown, TelemetryProfile } from '../types';
import { zeroCostBreakdown } from './stub';

// TODO(stage-4): implement Grafana Cloud pricing (Loki GB, Tempo GB, Mimir active series).
export function calculateGrafanaCloudCost(_profile: TelemetryProfile): CostBreakdown {
  return zeroCostBreakdown('grafana-cloud', ['Coming in Stage 4: Grafana Cloud pricing model not implemented yet.']);
}

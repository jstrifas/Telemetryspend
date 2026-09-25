import type { OptimizationRecommendation, TelemetryProfile } from './types';

// TODO(stage-3): generate real recommendations ranked by estimated savings.
export function suggestOptimizations(
  _profile: TelemetryProfile,
  _currentMonthlyCostUsd: number,
): OptimizationRecommendation[] {
  return [
    {
      id: 'placeholder',
      category: 'sampling',
      title: 'Placeholder recommendation',
      description: 'Optimization engine not implemented yet.',
      estimated_monthly_savings_usd: 0,
      effort: 'minutes',
      tradeoffs: 'None; this is placeholder data.',
    },
  ];
}

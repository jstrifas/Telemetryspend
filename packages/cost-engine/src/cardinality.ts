import type { CardinalityAnalysis, CardinalityScenario, TelemetryProfile } from './types';
import { DATADOG_PRICING, datadogBillableMetrics } from './vendors/datadog-pricing';

// Services, environments, regions, etc. typically have 3-20 values each.
const BASE_CARDINALITY_PER_DIMENSION = 10;

// Assumed spread for high-cardinality tags with no matching scale hint.
export const DEFAULT_HIGH_CARDINALITY_VALUES = 1000;

/** Default fraction of metrics carrying the high-cardinality tags, per scenario. */
export const CARDINALITY_SCOPE_DEFAULTS: Record<CardinalityScenario, number> = {
  uncapped: 1.0,
  scoped: 0.25,
  bounded: 0.05,
};

export type CardinalityScenarios = Record<CardinalityScenario, number>;

export function cardinalityScopeRatios(profile: TelemetryProfile): CardinalityScenarios {
  return {
    uncapped: profile.cardinality_scope_uncapped ?? CARDINALITY_SCOPE_DEFAULTS.uncapped,
    scoped: profile.cardinality_scope_scoped ?? CARDINALITY_SCOPE_DEFAULTS.scoped,
    bounded: profile.cardinality_scope_bounded ?? CARDINALITY_SCOPE_DEFAULTS.bounded,
  };
}

/** `ratio` of the base series carry the multiplier; the rest stay as they are. */
function applyScope(baseSeries: number, multiplier: number, ratio: number): number {
  return Math.round(baseSeries * ratio * multiplier + baseSeries * (1 - ratio));
}

/**
 * Unique metric series in each scenario. Each low-cardinality dimension
 * contributes ~10 values; the high-cardinality tags multiply the share of
 * series that carry them.
 */
export function calculateCardinalityScenarios(profile: TelemetryProfile): CardinalityScenarios {
  const baseSeries = Math.pow(BASE_CARDINALITY_PER_DIMENSION, profile.metric_cardinality_dimensions.length);

  if (profile.high_cardinality_tags.length === 0) {
    return { uncapped: baseSeries, scoped: baseSeries, bounded: baseSeries };
  }

  // Multiplier if a metric carries every high-cardinality tag.
  let fullMultiplier = 1;
  for (const tag of profile.high_cardinality_tags) {
    fullMultiplier *= estimateUniqueValues(tag, profile);
  }

  const ratios = cardinalityScopeRatios(profile);
  return {
    uncapped: applyScope(baseSeries, fullMultiplier, ratios.uncapped),
    scoped: applyScope(baseSeries, fullMultiplier, ratios.scoped),
    bounded: applyScope(baseSeries, fullMultiplier, ratios.bounded),
  };
}

/** Maps common high-cardinality tag names to the profile's scale hints. */
export function estimateUniqueValues(tag: string, profile: TelemetryProfile): number {
  const lowerTag = tag.toLowerCase();
  if (lowerTag.includes('user') && profile.unique_users_per_month) {
    return profile.unique_users_per_month;
  }
  if (lowerTag.includes('container') && profile.unique_containers) {
    return profile.unique_containers;
  }
  if (lowerTag.includes('endpoint') && profile.unique_endpoints) {
    return profile.unique_endpoints;
  }
  return DEFAULT_HIGH_CARDINALITY_VALUES;
}

/**
 * Series and Datadog custom-metric cost impact of adding `proposedTag`, under
 * each scoping scenario. If the profile already lists the tag, it is excluded
 * from the baseline so its values are not counted twice.
 */
export function analyzeCardinalityImpact(
  profile: TelemetryProfile,
  proposedTag: string,
  estimatedUniqueValues: number,
): CardinalityAnalysis {
  const baselineProfile: TelemetryProfile = {
    ...profile,
    high_cardinality_tags: profile.high_cardinality_tags.filter((tag) => tag !== proposedTag),
  };
  const base_series_count = calculateCardinalityScenarios(baselineProfile).uncapped;
  const ratios = cardinalityScopeRatios(profile);

  const scenarioFor = (ratio: number) => {
    const series_count = applyScope(base_series_count, estimatedUniqueValues, ratio);
    const billableDelta = datadogBillableMetrics(series_count) - datadogBillableMetrics(base_series_count);
    const monthly_cost_delta_usd = Math.round(billableDelta * DATADOG_PRICING.customMetricPerMonth * 100) / 100;
    return { series_count, monthly_cost_delta_usd };
  };

  const uncapped = scenarioFor(ratios.uncapped);
  const scoped = scenarioFor(ratios.scoped);
  const bounded = scenarioFor(ratios.bounded);

  let warning_level: CardinalityAnalysis['warning_level'];
  if (estimatedUniqueValues < 100) warning_level = 'safe';
  else if (estimatedUniqueValues < 10_000) warning_level = 'caution';
  else warning_level = 'severe';

  return {
    base_series_count,
    scenarios: { uncapped, scoped, bounded },
    multiplier: estimatedUniqueValues,
    warning_level,
    risk_exposure_usd: Math.round((uncapped.monthly_cost_delta_usd - bounded.monthly_cost_delta_usd) * 100) / 100,
  };
}

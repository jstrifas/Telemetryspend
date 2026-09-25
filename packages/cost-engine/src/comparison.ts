import { VENDORS } from './schemas';
import type { CardinalityScenario, CostBreakdown, TelemetryProfile, Vendor } from './types';
import { IMPLEMENTED_VENDORS, VENDOR_LABELS, metricsCostForSeries, vendorCalculators } from './vendors';

// Datadog and CloudWatch are real; the other vendors return zeros until Stage 4.
export function estimateCost(profile: TelemetryProfile, vendor: Vendor): CostBreakdown {
  return vendorCalculators[vendor](profile);
}

export function compareVendors(profile: TelemetryProfile): CostBreakdown[] {
  return VENDORS.map((vendor) => estimateCost(profile, vendor));
}

export interface VendorComparison {
  vendors: CostBreakdown[];
  cheapest_by_scenario: Record<CardinalityScenario, Vendor>;
  /** Series count where the bounded and uncapped winners' metrics costs cross; null if one vendor wins both. */
  metrics_crossover_series: number | null;
  summary: string;
}

const usd = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`;

/** "1.6M", "250K": approximate on purpose, the crossover is an estimate. */
export const formatSeries = (series: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(series);

function cheapestFor(breakdowns: CostBreakdown[], scenario: CardinalityScenario): CostBreakdown {
  const key = `${scenario}_usd` as const;
  return breakdowns.reduce((min, b) => (b.totals[key] < min.totals[key] ? b : min));
}

/**
 * Smallest series count at which the cheaper vendor for metrics flips between
 * `a` and `b`. Scans a geometric grid, then bisects to the exact count.
 */
export function findMetricsCrossover(a: Vendor, b: Vendor, maxSeries = 1e10): number | null {
  const costA = metricsCostForSeries[a];
  const costB = metricsCostForSeries[b];
  if (!costA || !costB) return null;

  const sign = (series: number) => Math.sign(costA(series) - costB(series));
  let low = 1;
  let lowSign = sign(low);
  for (let high = 2; high <= maxSeries; high = Math.ceil(high * 1.25)) {
    const highSign = sign(high);
    if (highSign !== 0 && lowSign !== 0 && highSign !== lowSign) {
      let hi = high;
      while (hi - low > 1) {
        const mid = Math.floor((low + hi) / 2);
        if (sign(mid) === lowSign) low = mid;
        else hi = mid;
      }
      return hi;
    }
    if (highSign !== 0) lowSign = highSign;
    low = high;
  }
  return null;
}

/** All vendors plus the cheapest real vendor per cardinality scenario. */
export function buildVendorComparison(profile: TelemetryProfile): VendorComparison {
  const vendors = compareVendors(profile);
  const priced = vendors.filter((b) => IMPLEMENTED_VENDORS.includes(b.vendor));

  const bounded = cheapestFor(priced, 'bounded');
  const scoped = cheapestFor(priced, 'scoped');
  const uncapped = cheapestFor(priced, 'uncapped');

  const crossover = bounded.vendor === uncapped.vendor ? null : findMetricsCrossover(bounded.vendor, uncapped.vendor);

  const summary = [
    `Cheapest at bounded scope: ${VENDOR_LABELS[bounded.vendor]} (${usd(bounded.totals.bounded_usd)}/mo).`,
    `Cheapest at uncapped scope: ${VENDOR_LABELS[uncapped.vendor]} (${usd(uncapped.totals.uncapped_usd)}/mo).`,
    crossover !== null
      ? `Metrics costs cross over at ~${formatSeries(crossover)} series: ${VENDOR_LABELS[bounded.vendor]} is cheaper below, ${VENDOR_LABELS[uncapped.vendor]} above.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    vendors,
    cheapest_by_scenario: { uncapped: uncapped.vendor, scoped: scoped.vendor, bounded: bounded.vendor },
    metrics_crossover_series: crossover,
    summary,
  };
}

import type { CostBreakdown, Vendor } from '../types';

/** All-zero breakdown for vendors whose pricing model isn't implemented yet. */
export function zeroCostBreakdown(vendor: Vendor, notes: string[]): CostBreakdown {
  return {
    vendor,
    logs_usd: 0,
    traces_usd: 0,
    metrics: { uncapped_usd: 0, scoped_usd: 0, bounded_usd: 0 },
    totals: { uncapped_usd: 0, scoped_usd: 0, bounded_usd: 0 },
    cardinality: { uncapped_series: 0, scoped_series: 0, bounded_series: 0 },
    notes,
  };
}

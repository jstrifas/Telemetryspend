// Approximate pricing based on Datadog's public pricing page as of [Q4 2026].
// Actual costs vary by commitment tier, negotiated rates, and product mix.
// This is an estimate for planning purposes, not a quote.

export const DATADOG_PRICING = {
  retentionBaselineDays: 15,
  // Retention premium: +30% per 15 days beyond the baseline (30d = 1.3x, 60d = 1.9x).
  // Retention below the baseline is billed at the baseline rate.
  retentionPremiumPerBaselinePeriod: 0.3,

  logEventsPerGb: 2_000_000, // typical structured logs
  logIngestionPerMillionEvents: 0.1,
  logIndexingRatio: 0.15, // share of ingested logs that are indexed (typical default)
  logIndexingPerMillionEvents: 1.27, // at the 15-day baseline

  apmIngestionPerMillionSpans: 0.1,
  apmIndexingPerMillionSpans: 1.06, // at the 15-day baseline

  customMetricsIncluded: 100,
  customMetricPerMonth: 0.05,
} as const;

export const DAYS_PER_MONTH = 30;

export function datadogBillableMetrics(seriesCount: number): number {
  return Math.max(0, seriesCount - DATADOG_PRICING.customMetricsIncluded);
}

/** Custom-metric cost for a series count. */
export function datadogMetricsCostForSeries(seriesCount: number): number {
  return datadogBillableMetrics(seriesCount) * DATADOG_PRICING.customMetricPerMonth;
}

/** Compressed (sub-linear) retention curve shared by logs and traces. */
export function datadogRetentionMultiplier(retentionDays: number): number {
  const { retentionBaselineDays, retentionPremiumPerBaselinePeriod } = DATADOG_PRICING;
  return 1 + retentionPremiumPerBaselinePeriod * Math.max(0, (retentionDays - retentionBaselineDays) / retentionBaselineDays);
}

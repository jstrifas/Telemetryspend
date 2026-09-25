// Approximate pricing based on AWS CloudWatch public rates for us-east-1 as of Q4 2026.
// Excludes alarms, Logs Insights queries, contributor insights, dashboards, and canaries.
// Estimate for planning only, not a quote.

import { calculateCardinalityScenarios } from '../cardinality';
import type { CostBreakdown, TelemetryProfile } from '../types';
import { DAYS_PER_MONTH } from './datadog-pricing';

export const CLOUDWATCH_PRICING = {
  logIngestPerGb: 0.5, // standard application logs; vended logs not modeled
  logCompressionRatio: 0.15, // stored size after CloudWatch's automatic compression
  logStoragePerGbMonth: 0.03,

  // Custom metrics, tiered per metric per month. `upTo` is the cumulative metric count.
  metricTiers: [
    { upTo: 10_000, perMetric: 0.3 },
    { upTo: 250_000, perMetric: 0.1 },
    { upTo: 1_000_000, perMetric: 0.05 },
    { upTo: Infinity, perMetric: 0.02 },
  ],

  getMetricDataPerThousandMetrics: 0.01,
  getMetricDataRequestsPerMetricMonth: 200, // dashboards and alarms polling each metric
} as const;

const P = CLOUDWATCH_PRICING;
const roundCents = (usd: number) => Math.round(usd * 100) / 100;

/** Tiered custom-metric cost for a series count. */
export function calculateCloudWatchMetricsCost(seriesCount: number): number {
  let cost = 0;
  let tierStart = 0;
  for (const tier of P.metricTiers) {
    if (seriesCount <= tierStart) break;
    cost += (Math.min(seriesCount, tier.upTo) - tierStart) * tier.perMetric;
    tierStart = tier.upTo;
  }
  return cost;
}

/** GetMetricData overhead from dashboards and alarms querying each metric. */
export function calculateCloudWatchGetMetricDataCost(seriesCount: number): number {
  return ((seriesCount * P.getMetricDataRequestsPerMetricMonth) / 1_000) * P.getMetricDataPerThousandMetrics;
}

/** Everything CloudWatch bills for a metric series count: custom metrics + GetMetricData. */
export function cloudWatchMetricsCostForSeries(seriesCount: number): number {
  return calculateCloudWatchMetricsCost(seriesCount) + calculateCloudWatchGetMetricDataCost(seriesCount);
}

export function calculateCloudWatchCost(profile: TelemetryProfile): CostBreakdown {
  // Logs: ingest per GB, plus compressed storage held for the retention window.
  const monthlyLogGb = profile.daily_log_volume_gb * DAYS_PER_MONTH;
  const logIngestCost = monthlyLogGb * P.logIngestPerGb;
  const storedGb = monthlyLogGb * P.logCompressionRatio;
  const retentionMonths = profile.log_retention_days / DAYS_PER_MONTH;
  const logStorageCost = storedGb * retentionMonths * P.logStoragePerGbMonth;
  const logsUsd = logIngestCost + logStorageCost;

  // Traces: AWS tracing is X-Ray, priced separately and not modeled.
  const tracesUsd = 0;

  // Metrics: same cardinality scenarios as every vendor, priced on CloudWatch tiers.
  const series = calculateCardinalityScenarios(profile);
  const metrics = {
    uncapped_usd: roundCents(cloudWatchMetricsCostForSeries(series.uncapped)),
    scoped_usd: roundCents(cloudWatchMetricsCostForSeries(series.scoped)),
    bounded_usd: roundCents(cloudWatchMetricsCostForSeries(series.bounded)),
  };

  return {
    vendor: 'aws-cloudwatch',
    logs_usd: roundCents(logsUsd),
    traces_usd: tracesUsd,
    metrics,
    totals: {
      uncapped_usd: roundCents(logsUsd + tracesUsd + metrics.uncapped_usd),
      scoped_usd: roundCents(logsUsd + tracesUsd + metrics.scoped_usd),
      bounded_usd: roundCents(logsUsd + tracesUsd + metrics.bounded_usd),
    },
    cardinality: {
      uncapped_series: series.uncapped,
      scoped_series: series.scoped,
      bounded_series: series.bounded,
    },
    notes: [
      'Approximate CloudWatch pricing (us-east-1). Not a quote.',
      'AWS tracing is X-Ray (separate pricing) — not modeled in this comparison',
      profile.high_cardinality_tags.length > 0
        ? 'Custom metrics dominate cost at high cardinality — CloudWatch tiered pricing helps beyond 250K metrics'
        : 'No high-cardinality tags — CloudWatch metrics costs are minimal',
      profile.log_retention_days > 30 ? 'Consider CloudWatch Logs Insights → S3 export for long retention' : '',
    ].filter(Boolean),
  };
}

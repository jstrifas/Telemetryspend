// Approximate pricing based on Datadog's public pricing page as of [Q4 2026].
// Actual costs vary by commitment tier, negotiated rates, and product mix.
// This is an estimate for planning purposes, not a quote.

import { calculateCardinalityScenarios } from '../cardinality';
import type { CostBreakdown, TelemetryProfile } from '../types';
import {
  DATADOG_PRICING as P,
  DAYS_PER_MONTH,
  datadogBillableMetrics,
  datadogRetentionMultiplier,
} from './datadog-pricing';

const roundCents = (usd: number) => Math.round(usd * 100) / 100;

export function calculateDatadogCost(profile: TelemetryProfile): CostBreakdown {
  // Logs: ingestion on every event, indexing only on the indexed share.
  const monthlyLogGb = profile.daily_log_volume_gb * DAYS_PER_MONTH;
  const monthlyLogEventsMillions = (monthlyLogGb * P.logEventsPerGb) / 1_000_000;
  const logIngestionCost = monthlyLogEventsMillions * P.logIngestionPerMillionEvents;
  const indexedEventsMillions = monthlyLogEventsMillions * P.logIndexingRatio;
  const logIndexingCost =
    indexedEventsMillions * P.logIndexingPerMillionEvents * datadogRetentionMultiplier(profile.log_retention_days);
  const logsUsd = logIngestionCost + logIndexingCost;

  // Traces: ingestion-based APM on sampled spans; all sampled spans are indexed.
  const dailySampledSpans = profile.daily_span_count * profile.trace_sampling_rate;
  const monthlySampledSpansMillions = (dailySampledSpans * DAYS_PER_MONTH) / 1_000_000;
  const traceIngestionCost = monthlySampledSpansMillions * P.apmIngestionPerMillionSpans;
  const traceIndexingCost =
    monthlySampledSpansMillions * P.apmIndexingPerMillionSpans * datadogRetentionMultiplier(profile.trace_retention_days);
  const tracesUsd = traceIngestionCost + traceIndexingCost;

  // Metrics: each unique metric + tag-value combination is a billable custom
  // metric, priced under each cardinality scoping scenario.
  const series = calculateCardinalityScenarios(profile);
  const metricsCostFor = (seriesCount: number) =>
    roundCents(datadogBillableMetrics(seriesCount) * P.customMetricPerMonth);

  const metrics = {
    uncapped_usd: metricsCostFor(series.uncapped),
    scoped_usd: metricsCostFor(series.scoped),
    bounded_usd: metricsCostFor(series.bounded),
  };
  const riskExposureUsd = metrics.uncapped_usd - metrics.bounded_usd;

  return {
    vendor: 'datadog',
    logs_usd: roundCents(logsUsd),
    traces_usd: roundCents(tracesUsd),
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
      'Approximate pricing based on Datadog public rates. Not a quote.',
      profile.high_cardinality_tags.length > 0
        ? `Risk exposure: $${Math.round(riskExposureUsd).toLocaleString('en-US')}/mo delta between uncapped and bounded scenarios`
        : 'No high-cardinality tags — scenarios are identical',
      profile.log_retention_days > 30
        ? 'Log retention > 30 days significantly increases cost — consider archival'
        : '',
    ].filter(Boolean),
  };
}

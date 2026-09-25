import type { CostBreakdown, TelemetryProfile, Vendor } from '../types';
import { calculateCloudWatchCost, cloudWatchMetricsCostForSeries } from './aws-cloudwatch';
import { calculateDatadogCost } from './datadog';
import { datadogMetricsCostForSeries } from './datadog-pricing';
import { calculateGrafanaCloudCost } from './grafana-cloud';
import { calculateHoneycombCost } from './honeycomb';

export { calculateCloudWatchCost, calculateDatadogCost, calculateGrafanaCloudCost, calculateHoneycombCost };

export const VENDOR_LABELS: Record<Vendor, string> = {
  datadog: 'Datadog',
  'grafana-cloud': 'Grafana Cloud',
  'aws-cloudwatch': 'AWS CloudWatch',
  honeycomb: 'Honeycomb',
};

/** Vendors with a real pricing model; the rest return zeros. */
export const IMPLEMENTED_VENDORS: readonly Vendor[] = ['datadog', 'aws-cloudwatch'];

export const vendorCalculators: Record<Vendor, (profile: TelemetryProfile) => CostBreakdown> = {
  datadog: calculateDatadogCost,
  'grafana-cloud': calculateGrafanaCloudCost,
  'aws-cloudwatch': calculateCloudWatchCost,
  honeycomb: calculateHoneycombCost,
};

/** Monthly metrics cost as a function of series count, for implemented vendors. */
export const metricsCostForSeries: Partial<Record<Vendor, (seriesCount: number) => number>> = {
  datadog: datadogMetricsCostForSeries,
  'aws-cloudwatch': cloudWatchMetricsCostForSeries,
};

/** One-line description of how each implemented vendor prices metrics. */
export const METRICS_PRICING_SUMMARY: Partial<Record<Vendor, string>> = {
  datadog: 'a flat $0.05 per custom metric',
  'aws-cloudwatch': 'tiered from $0.30 down to $0.02 per metric past 1M',
};

/** What a vendor's figures leave out, where it skews a comparison. */
export const VENDOR_COVERAGE_GAPS: Partial<Record<Vendor, string>> = {
  'aws-cloudwatch': 'excludes tracing (AWS X-Ray is priced separately)',
};

import { z } from 'zod';
import type { TelemetryProfile, Vendor } from './types';

// Runtime validation for the public API. The interfaces in types.ts stay the
// source of truth; the assertions at the bottom fail typecheck if these drift.

export const VendorSchema = z.enum(['datadog', 'grafana-cloud', 'aws-cloudwatch', 'honeycomb']);

export const VENDORS: readonly Vendor[] = VendorSchema.options;

export const TelemetryProfileSchema = z.object({
  daily_log_volume_gb: z.number().nonnegative().describe('Log ingest volume per day, in GB'),
  log_retention_days: z.number().int().positive().describe('How long logs stay searchable, in days'),

  daily_span_count: z.number().nonnegative().describe('Total spans generated per day, before sampling'),
  trace_sampling_rate: z.number().min(0).max(1).describe('Fraction of traces kept, 0.0 to 1.0'),
  trace_retention_days: z.number().int().positive().describe('How long traces are retained, in days'),

  daily_metric_datapoints: z.number().nonnegative().describe('Metric datapoints ingested per day'),
  metric_cardinality_dimensions: z
    .array(z.string())
    .describe('Low-cardinality tag keys applied to metrics, e.g. ["service", "env", "region"]'),
  high_cardinality_tags: z
    .array(z.string())
    .describe('High-cardinality tag keys applied to metrics, e.g. ["user_id", "container_id"]'),

  unique_users_per_month: z.number().int().nonnegative().optional(),
  unique_containers: z.number().int().nonnegative().optional(),
  unique_endpoints: z.number().int().nonnegative().optional(),

  cardinality_scope_uncapped: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Worst case: fraction of metrics carrying the high-cardinality tags (default 1.0)'),
  cardinality_scope_scoped: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Disciplined team: fraction of metrics carrying the high-cardinality tags (default 0.25)'),
  cardinality_scope_bounded: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Surgically scoped: fraction of metrics carrying the high-cardinality tags (default 0.05)'),
});

export const EstimateCostInputSchema = TelemetryProfileSchema.extend({
  vendor: VendorSchema,
});

export const CompareVendorsInputSchema = TelemetryProfileSchema;

export const AnalyzeCardinalityInputSchema = TelemetryProfileSchema.extend({
  proposed_tag: z.string().min(1).describe('Tag key being considered, e.g. "user_id"'),
  estimated_unique_values: z.number().int().positive().describe('Expected distinct values for the tag'),
});

export const SuggestOptimizationsInputSchema = TelemetryProfileSchema.extend({
  current_monthly_cost_usd: z.number().nonnegative(),
});

type Assert<T extends true> = T;
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _ProfileInSync = Assert<MutuallyAssignable<z.infer<typeof TelemetryProfileSchema>, TelemetryProfile>>;
type _VendorInSync = Assert<MutuallyAssignable<z.infer<typeof VendorSchema>, Vendor>>;

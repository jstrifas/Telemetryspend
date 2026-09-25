import type { TelemetryProfile } from '@telemetryspend/cost-engine';

export type PresetId = 'small-startup' | 'scale-up-saas' | 'enterprise';

export interface Preset {
  id: PresetId;
  label: string;
  summary: string;
  profile: TelemetryProfile;
}

// Illustrative starting points, not benchmarks. Each carries one
// high-cardinality tag so the uncapped / scoped / bounded spread is visible.
export const PRESETS: readonly Preset[] = [
  {
    id: 'small-startup',
    label: 'Small Startup',
    summary: '5 GB/day of logs, 500K spans/day, user_id across 1K users',
    profile: {
      daily_log_volume_gb: 5,
      log_retention_days: 7,
      daily_span_count: 500_000,
      trace_sampling_rate: 0.25,
      trace_retention_days: 7,
      daily_metric_datapoints: 200_000,
      metric_cardinality_dimensions: ['service', 'env'],
      high_cardinality_tags: ['user_id'],
      unique_users_per_month: 1_000,
    },
  },
  {
    id: 'scale-up-saas',
    label: 'Scale-Up SaaS',
    summary: '50 GB/day of logs, 5M spans/day, user_id across 10K users',
    profile: {
      daily_log_volume_gb: 50,
      log_retention_days: 15,
      daily_span_count: 5_000_000,
      trace_sampling_rate: 0.1,
      trace_retention_days: 15,
      daily_metric_datapoints: 1_000_000,
      metric_cardinality_dimensions: ['service', 'env', 'region'],
      high_cardinality_tags: ['user_id'],
      unique_users_per_month: 10_000,
    },
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    summary: '500 GB/day of logs, 50M spans/day, container_id across 2K containers',
    profile: {
      daily_log_volume_gb: 500,
      log_retention_days: 30,
      daily_span_count: 50_000_000,
      trace_sampling_rate: 0.05,
      trace_retention_days: 30,
      daily_metric_datapoints: 20_000_000,
      metric_cardinality_dimensions: ['service', 'env', 'region', 'cluster'],
      high_cardinality_tags: ['container_id'],
      unique_containers: 2_000,
    },
  },
];

export const DEFAULT_PRESET_ID: PresetId = 'scale-up-saas';

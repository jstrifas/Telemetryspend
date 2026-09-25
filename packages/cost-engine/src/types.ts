export type Vendor = 'datadog' | 'grafana-cloud' | 'aws-cloudwatch' | 'honeycomb';

export interface TelemetryProfile {
  // Logs
  daily_log_volume_gb: number;
  log_retention_days: number;

  // Traces
  daily_span_count: number;              // Total spans per day
  trace_sampling_rate: number;           // 0.0 to 1.0
  trace_retention_days: number;

  // Metrics
  daily_metric_datapoints: number;
  metric_cardinality_dimensions: string[]; // e.g. ["service", "env", "region"]
  high_cardinality_tags: string[];         // e.g. ["user_id", "container_id"]

  // Scale hints (used for cardinality math)
  unique_users_per_month?: number;
  unique_containers?: number;
  unique_endpoints?: number;

  // Cardinality scoping ratios: fraction of metrics carrying the
  // high-cardinality tags in each scenario. Each is 0.0-1.0.
  // Defaults if not provided: uncapped=1.0, scoped=0.25, bounded=0.05
  cardinality_scope_uncapped?: number;
  cardinality_scope_scoped?: number;
  cardinality_scope_bounded?: number;
}

export type CardinalityScenario = 'uncapped' | 'scoped' | 'bounded';

export interface CostBreakdown {
  vendor: Vendor;
  logs_usd: number;                      // Same across all scenarios
  traces_usd: number;                    // Same across all scenarios
  metrics: {
    uncapped_usd: number;                // Worst case
    scoped_usd: number;                  // Realistic
    bounded_usd: number;                 // Disciplined
  };
  totals: {
    uncapped_usd: number;                // logs + traces + metrics.uncapped
    scoped_usd: number;                  // logs + traces + metrics.scoped
    bounded_usd: number;                 // logs + traces + metrics.bounded
  };
  cardinality: {
    uncapped_series: number;             // Total series in uncapped scenario
    scoped_series: number;
    bounded_series: number;
  };
  notes: string[];                       // Vendor-specific caveats
}

export interface CardinalityScenarioImpact {
  series_count: number;
  monthly_cost_delta_usd: number;
}

export interface CardinalityAnalysis {
  base_series_count: number;             // Before adding the proposed tag
  scenarios: Record<CardinalityScenario, CardinalityScenarioImpact>;
  multiplier: number;                    // The proposed tag's unique value count
  warning_level: 'safe' | 'caution' | 'severe';
  risk_exposure_usd: number;             // uncapped - bounded (the risk delta)
}

export interface OptimizationRecommendation {
  id: string;
  category: 'sampling' | 'retention' | 'cardinality' | 'vendor-switch';
  title: string;
  description: string;
  estimated_monthly_savings_usd: number;
  effort: 'minutes' | 'hours' | 'days';
  tradeoffs: string;                     // What you give up
}

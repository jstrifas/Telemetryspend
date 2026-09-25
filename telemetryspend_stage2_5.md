# TelemetrySpend — Claude Code Stage 2.5 Brief

Copy the section below the horizontal rule into Claude Code. Assumes
Stage 2 is complete and the Datadog cost engine returns credible numbers
(~$2,166 for the 100 GB/day baseline profile).

**Before pasting:** Confirm your working directory is the repo root and
`npm run build --workspace=apps/mcp-server` currently succeeds.

---

Stage 2.5. Small but important structural refactor. We're changing the
product identity from "typical cost estimator" to "cardinality risk
analyzer" by exposing three cost scenarios side-by-side instead of one:

- **Uncapped** — 100% of metrics carry the high-cardinality tag (worst case)
- **Scoped** — 25% of metrics carry it (disciplined team default)
- **Bounded** — 5% of metrics carry it (only where actually needed)

The delta between these three numbers *is* the cardinality warning. That
framing turns a scary number into a decision aid.

## Type changes in `packages/cost-engine/src/types.ts`

Add three new fields to `TelemetryProfile` (all optional with defaults):

```typescript
export interface TelemetryProfile {
  // ... existing fields unchanged ...

  // NEW: Cardinality scoping ratios. Each is 0.0-1.0.
  // Defaults if not provided: uncapped=1.0, scoped=0.25, bounded=0.05
  cardinality_scope_uncapped?: number;
  cardinality_scope_scoped?: number;
  cardinality_scope_bounded?: number;
}
```

Replace `CostBreakdown` with a version that splits metrics into three
scenarios:

```typescript
export interface CostBreakdown {
  vendor: Vendor;
  logs_usd: number;                     // Same across all scenarios
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
  notes: string[];
}
```

Update `CardinalityAnalysis` to reflect the three-way model:

```typescript
export interface CardinalityAnalysis {
  base_series_count: number;             // Before adding the proposed tag
  scenarios: {
    uncapped: {
      series_count: number;
      monthly_cost_delta_usd: number;
    };
    scoped: {
      series_count: number;
      monthly_cost_delta_usd: number;
    };
    bounded: {
      series_count: number;
      monthly_cost_delta_usd: number;
    };
  };
  multiplier: number;                    // The proposed tag's unique value count
  warning_level: 'safe' | 'caution' | 'severe';
  risk_exposure_usd: number;             // uncapped - bounded (the risk delta)
}
```

## Cardinality math changes in `packages/cost-engine/src/cardinality.ts`

Replace `calculateTotalCardinality` with a version that returns all three:

```typescript
export interface CardinalityScenarios {
  uncapped: number;
  scoped: number;
  bounded: number;
}

export function calculateCardinalityScenarios(
  profile: TelemetryProfile
): CardinalityScenarios {
  const BASE_CARDINALITY_PER_DIMENSION = 10;
  const base_series = Math.pow(
    BASE_CARDINALITY_PER_DIMENSION,
    profile.metric_cardinality_dimensions.length
  );

  // If no high-cardinality tags, all three scenarios are identical
  if (profile.high_cardinality_tags.length === 0) {
    return {
      uncapped: base_series,
      scoped: base_series,
      bounded: base_series,
    };
  }

  // Total multiplier if ALL metrics carried the high-card tags
  let full_multiplier = 1;
  for (const tag of profile.high_cardinality_tags) {
    const unique_values = estimateUniqueValues(tag, profile);
    full_multiplier *= unique_values;
  }

  const uncapped_ratio = profile.cardinality_scope_uncapped ?? 1.0;
  const scoped_ratio = profile.cardinality_scope_scoped ?? 0.25;
  const bounded_ratio = profile.cardinality_scope_bounded ?? 0.05;

  // In each scenario: some fraction of base_series carries the full multiplier,
  // the rest stays at base_series count.
  const applyRatio = (ratio: number): number => {
    const affected = base_series * ratio;
    const unaffected = base_series * (1 - ratio);
    return affected * full_multiplier + unaffected;
  };

  return {
    uncapped: Math.round(applyRatio(uncapped_ratio)),
    scoped: Math.round(applyRatio(scoped_ratio)),
    bounded: Math.round(applyRatio(bounded_ratio)),
  };
}

function estimateUniqueValues(tag: string, profile: TelemetryProfile): number {
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
  return 1000; // Fallback for unknown high-cardinality tags
}
```

Replace `analyzeCardinalityImpact` with the three-way version:

```typescript
export function analyzeCardinalityImpact(
  profile: TelemetryProfile,
  proposed_tag: string,
  estimated_unique_values: number
): CardinalityAnalysis {
  const base = calculateCardinalityScenarios(profile);
  const base_series_count = base.uncapped; // Before proposed tag

  const uncapped_ratio = profile.cardinality_scope_uncapped ?? 1.0;
  const scoped_ratio = profile.cardinality_scope_scoped ?? 0.25;
  const bounded_ratio = profile.cardinality_scope_bounded ?? 0.05;

  const scenarioFor = (ratio: number) => {
    const affected = base_series_count * ratio;
    const unaffected = base_series_count * (1 - ratio);
    const series_count = Math.round(
      affected * estimated_unique_values + unaffected
    );
    const old_billable = Math.max(0, base_series_count - 100);
    const new_billable = Math.max(0, series_count - 100);
    const monthly_cost_delta_usd =
      Math.round((new_billable - old_billable) * 0.05 * 100) / 100;
    return { series_count, monthly_cost_delta_usd };
  };

  const uncapped = scenarioFor(uncapped_ratio);
  const scoped = scenarioFor(scoped_ratio);
  const bounded = scenarioFor(bounded_ratio);

  let warning_level: 'safe' | 'caution' | 'severe';
  if (estimated_unique_values < 100) warning_level = 'safe';
  else if (estimated_unique_values < 10_000) warning_level = 'caution';
  else warning_level = 'severe';

  return {
    base_series_count,
    scenarios: { uncapped, scoped, bounded },
    multiplier: estimated_unique_values,
    warning_level,
    risk_exposure_usd:
      uncapped.monthly_cost_delta_usd - bounded.monthly_cost_delta_usd,
  };
}
```

## Datadog engine changes in `packages/cost-engine/src/vendors/datadog.ts`

Replace the metrics section of `calculateDatadogCost` to produce three
numbers instead of one:

```typescript
export function calculateDatadogCost(profile: TelemetryProfile): CostBreakdown {
  // Logs and traces calculations unchanged from Stage 2 fix
  // ... (keep the corrected log ingestion + indexing math)
  // ... (keep the trace ingestion + indexing math)

  // METRICS: three scenarios
  const scenarios = calculateCardinalityScenarios(profile);

  const metricsCostFor = (series_count: number): number => {
    const billable = Math.max(0, series_count - 100);
    return Math.round(billable * 0.05 * 100) / 100;
  };

  const metrics_uncapped_usd = metricsCostFor(scenarios.uncapped);
  const metrics_scoped_usd = metricsCostFor(scenarios.scoped);
  const metrics_bounded_usd = metricsCostFor(scenarios.bounded);

  return {
    vendor: 'datadog',
    logs_usd: Math.round(logs_usd * 100) / 100,
    traces_usd: Math.round(traces_usd * 100) / 100,
    metrics: {
      uncapped_usd: metrics_uncapped_usd,
      scoped_usd: metrics_scoped_usd,
      bounded_usd: metrics_bounded_usd,
    },
    totals: {
      uncapped_usd:
        Math.round((logs_usd + traces_usd + metrics_uncapped_usd) * 100) / 100,
      scoped_usd:
        Math.round((logs_usd + traces_usd + metrics_scoped_usd) * 100) / 100,
      bounded_usd:
        Math.round((logs_usd + traces_usd + metrics_bounded_usd) * 100) / 100,
    },
    cardinality: {
      uncapped_series: scenarios.uncapped,
      scoped_series: scenarios.scoped,
      bounded_series: scenarios.bounded,
    },
    notes: [
      'Approximate pricing based on Datadog public rates. Not a quote.',
      profile.high_cardinality_tags.length > 0
        ? `Risk exposure: $${(metrics_uncapped_usd - metrics_bounded_usd).toFixed(0)}/mo delta between uncapped and bounded scenarios`
        : 'No high-cardinality tags — scenarios are identical',
      profile.log_retention_days > 30
        ? 'Log retention > 30 days significantly increases cost — consider archival'
        : ''
    ].filter(Boolean)
  };
}
```

## Web UI changes

### `apps/web/components/TelemetryProfileForm.tsx`

Add a new section titled **"Cardinality Discipline"** shown only when
the user has selected any high-cardinality tags. Three sliders (or
number inputs, whichever renders cleaner):

- **Uncapped ratio** — 0-100%, default 100. Labeled "Fraction of metrics that carry the tag in worst case"
- **Scoped ratio** — 0-100%, default 25. Labeled "Fraction if disciplined"
- **Bounded ratio** — 0-100%, default 5. Labeled "Fraction if surgically scoped"

Each slider updates the corresponding `cardinality_scope_*` field on
the profile.

### `apps/web/components/VendorComparisonChart.tsx`

Now shows **three bars per vendor**: Uncapped, Scoped, Bounded — stacked
by cost category (logs + traces + metrics). Group by vendor with the
three scenarios side-by-side within each group.

Colors:
- Uncapped bar: red-tinted (danger)
- Scoped bar: yellow-tinted (realistic)
- Bounded bar: green-tinted (disciplined)

Above the vendor group, show a text label: "Risk exposure: $X" where X is
uncapped total minus bounded total.

### `apps/web/components/CardinalityWarning.tsx`

Rewrite to show three scenarios in a table:

| Scenario | Series count | Monthly cost |
|---|---|---|
| Uncapped | 10,000,000 | $500,000 |
| Scoped | 2,502,500 | $125,120 |
| Bounded | 500,500 | $25,020 |

**Risk exposure: $474,980/mo** — bold and prominent.

Warning banner above the table with the severity level.

## MCP tool changes

`estimate_observability_cost` now returns the full three-scenario
`CostBreakdown` object. The Claude Desktop demo becomes more powerful —
when a developer asks "what if I add user_id?", Claude can respond with:

*"Best case (bounded to 5% of metrics): $25K/month. Worst case (all
metrics carry it): $500K/month. The risk delta is $475K — that's what
you're exposing yourself to if the tag propagates further than intended."*

`analyze_cardinality_impact` returns the full three-scenario
`CardinalityAnalysis` object.

## Verification after Stage 2.5

1. Run the same smoke test from earlier:

```
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"estimate_observability_cost","arguments":{"vendor":"datadog","daily_log_volume_gb":50,"log_retention_days":15,"daily_span_count":5000000,"trace_sampling_rate":0.1,"trace_retention_days":15,"daily_metric_datapoints":1000000,"metric_cardinality_dimensions":["service","env","region"],"high_cardinality_tags":["user_id"],"unique_users_per_month":10000}}}' | node apps/mcp-server/dist/index.js
```

Expected response should include three scenario totals. Rough expectations:
- `totals.uncapped_usd`: ~$500,000 (matches your Stage 2 result)
- `totals.scoped_usd`: ~$125,000
- `totals.bounded_usd`: ~$25,000

If the three numbers scale roughly as expected (uncapped ≈ 20× bounded,
scoped ≈ 5× bounded), the math is right.

2. In the web UI, load the same profile. Verify:
- Three bars appear per vendor in the chart (Datadog only for now)
- The CardinalityWarning table shows all three scenarios
- Adjusting the Scoped ratio slider updates the middle number in real time
- The "risk exposure" number equals uncapped total minus bounded total

## What to share back

Paste:
1. The MCP response for the smoke test above
2. Whether the three ratio sliders in the web UI update the chart in
   real time
3. Any deviations Claude Code made from the spec

Then we move to Stage 3: Grafana Cloud, AWS CloudWatch, and Honeycomb
pricing models — all now using the same three-scenario architecture.

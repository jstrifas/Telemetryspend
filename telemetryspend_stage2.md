# TelemetrySpend — Claude Code Stage 2 Brief

Copy the section below the horizontal rule into Claude Code as your next
prompt. Assumes Stage 1 scaffolding is in place and running.

**Before running Stage 2:** Verify these three things:
1. `telemetryspend/package.json` (root workspace file) exists with a
   `workspaces` field listing `apps/*` and `packages/*`
2. `npm run build --workspace=apps/mcp-server` completes without errors
3. `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node apps/mcp-server/dist/index.js`
   returns a JSON response listing 4 tools

If any of those fail, fix Stage 1 first. Stage 2 assumes a working
skeleton.

---

Stage 2 of the TelemetrySpend build. Goal: implement real Datadog pricing
math, the cardinality calculation core, and wire it through both surfaces
so I have **one vendor working end-to-end** before scaling to the other
three. This proves the architecture works before I invest in more scope.

## Deliverables for Stage 2

1. Real Datadog pricing math in `packages/cost-engine/src/vendors/datadog.ts`
2. Cardinality calculation logic in `packages/cost-engine/src/cardinality.ts`
3. Wired through the web UI: `TelemetryProfileForm` inputs → cost engine →
   `VendorComparisonChart` displays real Datadog cost (other three vendors
   stay zero for now)
4. Wired through the MCP `estimate_observability_cost` tool: real Datadog
   response when called
5. A `claude_desktop_config.json` snippet at the repo root showing how to
   register the MCP server in Claude Desktop for local testing

## Datadog pricing model to implement

Use published Datadog pricing as of Q4 2026. Model this as a function
`calculateDatadogCost(profile: TelemetryProfile): CostBreakdown`.

**Include a top-of-file comment noting:** "Approximate pricing based on
Datadog's public pricing page as of [Q4 2026]. Actual costs vary by
commitment tier, negotiated rates, and product mix. This is an estimate
for planning purposes, not a quote."

### Logs (Log Management)

Datadog logs pricing has two components:

- **Ingestion:** ~$0.10 per GB ingested
- **Indexing (retention-based):** Priced per million log events with a
  15-day retention baseline. Approximate: $1.27 per million events at
  15-day retention. Longer retention scales roughly linearly up to a cap.

Simplified model for the calculator:

```typescript
const monthly_log_gb = profile.daily_log_volume_gb * 30;
const ingestion_cost = monthly_log_gb * 0.10;

// Estimate events per GB (Datadog's rough guide: ~2M events per GB
// for typical structured logs)
const monthly_log_events_millions = (monthly_log_gb * 2_000_000) / 1_000_000;

// Retention multiplier: 15 days = 1.0x, scale from there
const retention_multiplier = profile.log_retention_days / 15;
const indexing_cost = monthly_log_events_millions * 1.27 * retention_multiplier;

const logs_usd = ingestion_cost + indexing_cost;
```

### Traces (APM)

Datadog APM has two pricing models — per-host and ingestion-based. For a
calculator, use ingestion-based since it maps cleanly to span counts:

- **Ingestion:** ~$0.10 per million spans ingested
- **Indexing:** ~$1.06 per million retained spans

```typescript
const daily_sampled_spans = profile.daily_span_count * profile.trace_sampling_rate;
const monthly_sampled_spans_millions = (daily_sampled_spans * 30) / 1_000_000;

const trace_ingestion_cost = monthly_sampled_spans_millions * 0.10;

const retention_multiplier_traces = profile.trace_retention_days / 15;
const trace_indexing_cost = monthly_sampled_spans_millions * 1.06 * retention_multiplier_traces;

const traces_usd = trace_ingestion_cost + trace_indexing_cost;
```

### Metrics (Custom Metrics)

This is where cardinality matters most. Datadog charges per custom metric
per month:

- **First 100 custom metrics:** included in most plans (model as free)
- **Beyond 100:** ~$0.05 per custom metric per month at Pro tier

A "custom metric" in Datadog is one unique combination of metric name +
tag values. Cardinality = number of unique combinations.

```typescript
// Get total custom metric count from cardinality analysis
const total_metrics = calculateTotalCardinality(profile);

const billable_metrics = Math.max(0, total_metrics - 100);
const metrics_usd = billable_metrics * 0.05;
```

`calculateTotalCardinality` is implemented in `cardinality.ts` (below).

### Return shape

```typescript
return {
  vendor: 'datadog',
  logs_usd: Math.round(logs_usd * 100) / 100,
  traces_usd: Math.round(traces_usd * 100) / 100,
  metrics_usd: Math.round(metrics_usd * 100) / 100,
  total_usd: Math.round((logs_usd + traces_usd + metrics_usd) * 100) / 100,
  notes: [
    'Assumes Pro tier pricing. Enterprise commitments typically 20-40% lower.',
    profile.high_cardinality_tags.length > 0
      ? `${profile.high_cardinality_tags.length} high-cardinality tag(s) detected — check the cardinality warning`
      : 'No high-cardinality tags detected',
    profile.log_retention_days > 30
      ? 'Log retention > 30 days significantly increases cost — consider archival to S3'
      : ''
  ].filter(Boolean)
};
```

## Cardinality calculation in `packages/cost-engine/src/cardinality.ts`

This is the mathematical core of the whole app. Two exported functions:

### Function 1: `calculateTotalCardinality`

```typescript
export function calculateTotalCardinality(profile: TelemetryProfile): number {
  // Base cardinality: product of low-cardinality dimensions
  // Assume each low-cardinality dimension has ~10 unique values on average
  // (services, environments, regions, etc. typically have 3-20 values)
  const BASE_CARDINALITY_PER_DIMENSION = 10;
  const base_series = Math.pow(
    BASE_CARDINALITY_PER_DIMENSION,
    profile.metric_cardinality_dimensions.length
  );

  // High-cardinality tags multiply the series count by their unique values
  let series_multiplier = 1;
  for (const tag of profile.high_cardinality_tags) {
    const unique_values = estimateUniqueValues(tag, profile);
    series_multiplier *= unique_values;
  }

  return base_series * series_multiplier;
}

function estimateUniqueValues(tag: string, profile: TelemetryProfile): number {
  // Map common high-cardinality tag names to their scale hints
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
  // Fallback for unknown high-cardinality tags: assume 1000 unique values
  return 1000;
}
```

### Function 2: `analyzeCardinalityImpact`

Used by the MCP tool `analyze_cardinality_impact` and the web UI's
cardinality warning component.

```typescript
export function analyzeCardinalityImpact(
  profile: TelemetryProfile,
  proposed_tag: string,
  estimated_unique_values: number
): CardinalityAnalysis {
  const base_series_count = calculateTotalCardinality(profile);
  const projected_series_count = base_series_count * estimated_unique_values;
  const multiplier = estimated_unique_values;

  // Cost delta: (new_billable_metrics - old_billable_metrics) * $0.05
  const old_billable = Math.max(0, base_series_count - 100);
  const new_billable = Math.max(0, projected_series_count - 100);
  const monthly_cost_delta_usd = Math.round((new_billable - old_billable) * 0.05 * 100) / 100;

  // Warning level thresholds
  let warning_level: 'safe' | 'caution' | 'severe';
  if (multiplier < 100) warning_level = 'safe';
  else if (multiplier < 10_000) warning_level = 'caution';
  else warning_level = 'severe';

  return {
    base_series_count,
    projected_series_count,
    multiplier,
    monthly_cost_delta_usd,
    warning_level
  };
}
```

## Wire through the web UI

### `apps/web/components/TelemetryProfileForm.tsx`

Replace the placeholder form with real inputs:

- **Log volume** — slider, 0 to 1000 GB/day (default 50)
- **Log retention** — slider, 1 to 90 days (default 15)
- **Daily span count** — slider, 0 to 100M (default 5M)
- **Trace sampling rate** — slider, 0.01 to 1.0 (default 0.1)
- **Trace retention** — slider, 1 to 30 days (default 15)
- **Daily metric datapoints** — slider, 0 to 100M (default 1M)
- **Low-cardinality dimensions** — multi-select chips (service, env, region,
  cluster, namespace, availability_zone) — default: [service, env, region]
- **High-cardinality tags** — multi-select chips (user_id, container_id,
  endpoint, request_id, session_id, trace_id) — default: [] (empty)
- **Scale hints** (conditional — only shown if high-cardinality tags
  selected):
  - Unique users per month — numeric input
  - Unique containers — numeric input
  - Unique endpoints — numeric input

State should be lifted to the parent page. Every change triggers a
recalculation via `useMemo`.

### `apps/web/app/calculator/page.tsx`

Import the cost engine:

```typescript
import { calculateDatadogCost, analyzeCardinalityImpact } from '@telemetryspend/cost-engine';
```

Wire the form state through `calculateDatadogCost`. Display the result in
`VendorComparisonChart` with Datadog as the only vendor showing real numbers
(the other three vendors render as $0 with a "Coming in Stage 3" note).

### `apps/web/components/VendorComparisonChart.tsx`

Implement a Recharts stacked bar chart:

- X-axis: vendor name (Datadog, Grafana Cloud, AWS CloudWatch, Honeycomb)
- Y-axis: monthly cost USD
- Stacked segments: Logs, Traces, Metrics (each a different color)
- Tooltip on hover showing exact breakdown
- Total cost labeled above each bar

Colors: use Tailwind's built-in palette — logs=blue-500, traces=purple-500,
metrics=amber-500. Dark mode compatible.

### `apps/web/components/CardinalityWarning.tsx`

Shown conditionally when the user has selected any high-cardinality tags.
Uses `analyzeCardinalityImpact` — treat one of the selected tags as the
"proposed" tag with the user's estimated unique value count.

Display:
- Base series count → projected series count
- Multiplier (e.g., "1,000x")
- Monthly cost delta
- Warning banner colored by warning_level (safe=green, caution=yellow,
  severe=red)

## Wire through the MCP `estimate_observability_cost` tool

In `apps/mcp-server/src/index.ts`, replace the placeholder handler for
`estimate_observability_cost`:

```typescript
import { calculateDatadogCost } from '@telemetryspend/cost-engine';

// In the CallToolRequestSchema handler:
case 'estimate_observability_cost': {
  const { vendor, ...profile } = request.params.arguments;

  if (vendor === 'datadog') {
    const result = calculateDatadogCost(profile as TelemetryProfile);
    return {
      content: [
        { type: 'text', text: JSON.stringify(result, null, 2) }
      ]
    };
  }

  // Other vendors not implemented yet
  return {
    content: [
      { type: 'text', text: `Vendor ${vendor} not yet implemented. Datadog only in Stage 2.` }
    ]
  };
}
```

## The tsup workspace-bundling gotcha

Because `packages/cost-engine` exports raw TypeScript source (not compiled
JS), `apps/mcp-server`'s tsup config needs to bundle workspace dependencies,
not externalize them.

Check `apps/mcp-server/tsup.config.ts`. If it doesn't exist, create it:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // CRITICAL: bundle workspace deps, don't externalize them
  noExternal: ['@telemetryspend/cost-engine'],
  // Externalize the MCP SDK (installed at runtime as npm dep)
  external: ['@modelcontextprotocol/sdk'],
});
```

Without `noExternal`, running `node dist/index.js` will throw "Cannot find
module @telemetryspend/cost-engine" at runtime.

## Claude Desktop config snippet

Create `claude_desktop_config.example.json` at the repo root:

```json
{
  "mcpServers": {
    "telemetryspend": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/telemetryspend/apps/mcp-server/dist/index.js"
      ]
    }
  }
}
```

Add a README section explaining:
1. Users must build first: `npm run build --workspace=apps/mcp-server`
2. Update the absolute path in the config
3. Merge this into their existing `claude_desktop_config.json` (on macOS:
   `~/Library/Application Support/Claude/claude_desktop_config.json`)
4. Restart Claude Desktop
5. Ask Claude something like: "Estimate my Datadog cost for 100 GB/day of
   logs with 30-day retention and 10M spans a day at 10% sampling."

## Verification steps to run after Stage 2

Before you consider Stage 2 done, verify:

1. **Type check passes across all workspaces:**
   ```
   npm run typecheck --workspaces
   ```

2. **Web app runs and calculator returns real Datadog numbers:**
   ```
   npm run dev --workspace=apps/web
   ```
   Open localhost:3000/calculator, move the log volume slider, see the
   Datadog bar in the chart update in real time.

3. **MCP server builds and answers with real Datadog math:**
   ```
   npm run build --workspace=apps/mcp-server
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"estimate_observability_cost","arguments":{"vendor":"datadog","daily_log_volume_gb":100,"log_retention_days":30,"daily_span_count":10000000,"trace_sampling_rate":0.1,"trace_retention_days":15,"daily_metric_datapoints":1000000,"metric_cardinality_dimensions":["service","env","region"],"high_cardinality_tags":[]}}}' | node apps/mcp-server/dist/index.js
   ```
   Should return a JSON response with real logs_usd, traces_usd,
   metrics_usd, and total_usd fields — not zeros.

4. **Cardinality math sanity check:** In the web UI, add "user_id" to
   high-cardinality tags and set unique_users_per_month to 10000. Cost
   should jump dramatically. The CardinalityWarning banner should turn
   red with a "severe" warning.

## What to skip in Stage 2

- Other three vendor pricing models (Stage 3)
- Preset buttons (Small Startup, Scale-Up SaaS, Enterprise) — will
  implement in Stage 3 once we have real numbers per vendor
- Optimization recommendations (Stage 3)
- The MCP `compare_vendors` and `suggest_optimizations` tools (Stage 3)
- Markdown export (Stage 4)
- Deployment (Stage 4)

## Share back after Stage 2

Please share:
1. Result of the smoke test in verification step #3 (the real MCP call
   with 100 GB/day logs). Paste the JSON response.
2. Whether the tsup config needed the `noExternal` fix or if it worked
   without it
3. Any deviations from the spec Claude Code made

That gives me what I need for Stage 3.

# TelemetrySpend — Claude Code Stage 1 Brief

Copy the section below the horizontal rule into Claude Code as the initial
project prompt. After Claude Code scaffolds the project, verify the
structure and come back for Stage 2 (cost engine implementation + first
vendor pricing model).

---

I'm building a portfolio project called **TelemetrySpend**. Please scaffold
it according to the spec below. Do not implement business logic yet — just
the project structure, dependencies, and a "hello world" version of each
component so I can verify the skeleton before we build real functionality.

## Project overview

TelemetrySpend is an interactive observability cost calculator. Developers
input their telemetry profile (log volume, trace retention, metric
cardinality, tag dimensions) and get real-time cost estimates across
Datadog, Grafana Cloud, AWS CloudWatch, and Honeycomb — plus a cardinality
explosion visualizer that shows how adding high-cardinality tags (user_id,
container_id) drives exponential metric-series cost growth.

The differentiator: **two surfaces sharing one cost engine.**
1. A Next.js web app with interactive sliders, live charts, vendor
   comparison, and optimization recommendations
2. A stdio-transport MCP server exposing the same calculation engine as
   tools any MCP client (Claude Desktop, Cursor, etc.) can call inline
   during development conversations

Target user: developer or platform engineer at a startup or scale-up who's
about to make an observability config decision (add a tag, change a
retention window, switch vendors) and wants to know the cost implication
before they ship.

## Repository structure — monorepo

Use npm workspaces (simplest option; pnpm would also work but npm keeps
setup lighter). Structure:

```
telemetryspend/
├── apps/
│   ├── web/                        # Next.js frontend on Vercel
│   │   ├── app/
│   │   ├── components/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   └── next.config.js
│   └── mcp-server/                 # Standalone Node MCP server
│       ├── src/
│       │   └── index.ts            # MCP stdio entrypoint
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── cost-engine/                # Shared TypeScript library
│       ├── src/
│       │   ├── index.ts            # Public API
│       │   ├── vendors/            # One file per vendor pricing model
│       │   ├── cardinality.ts      # Cardinality math
│       │   ├── optimization.ts     # Savings recommendations
│       │   └── types.ts            # Shared types
│       ├── package.json
│       └── tsconfig.json
├── package.json                    # Root workspace config
├── tsconfig.base.json              # Shared TS config
├── .gitignore
└── README.md
```

## Stack requirements

**Root workspace:**
- npm workspaces (`"workspaces": ["apps/*", "packages/*"]`)
- TypeScript 5.4+ across everything
- Shared `tsconfig.base.json` that individual packages extend

**`packages/cost-engine`:**
- Pure TypeScript library, no runtime dependencies except zod for schema validation
- Exports typed functions for cost calculation, vendor comparison,
  cardinality analysis, and optimization suggestions
- Must be importable by both `apps/web` and `apps/mcp-server`

**`apps/web`:**
- Next.js 14+ with App Router, TypeScript, React
- Tailwind CSS for styling
- Recharts for the stacked bar chart and cost distribution visuals
- No AI/LLM dependencies — this is a state-driven calculator, not an
  AI product
- Deployable to Vercel

**`apps/mcp-server`:**
- `@modelcontextprotocol/sdk` (the official MCP TypeScript SDK)
- stdio transport (`StdioServerTransport` from the SDK)
- Exposes 4 tools that wrap functions from `packages/cost-engine`
- Runs as a standalone Node process (`node dist/index.js`)

## Type definitions to establish in `packages/cost-engine/src/types.ts`

```typescript
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
}

export interface CostBreakdown {
  vendor: Vendor;
  logs_usd: number;
  traces_usd: number;
  metrics_usd: number;
  total_usd: number;
  notes: string[];                       // Vendor-specific caveats
}

export interface CardinalityAnalysis {
  base_series_count: number;             // Time series before high-cardinality tags
  projected_series_count: number;         // After proposed tags
  multiplier: number;                     // e.g. 250x
  monthly_cost_delta_usd: number;
  warning_level: 'safe' | 'caution' | 'severe';
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
```

## The 4 MCP tools to expose in `apps/mcp-server`

These wrap functions from `packages/cost-engine`. For Stage 1, register
them with the SDK but have each tool return a placeholder response — we'll
implement real logic in Stage 2.

**Tool 1: `estimate_observability_cost`**
- Description: "Estimates monthly observability cost for a given vendor based on a telemetry profile (log volume, trace retention, metric cardinality)."
- Input schema: TelemetryProfile + `vendor: Vendor`
- Returns: `CostBreakdown`

**Tool 2: `compare_vendors`**
- Description: "Compares monthly observability costs across Datadog, Grafana Cloud, AWS CloudWatch, and Honeycomb for a given telemetry profile."
- Input schema: TelemetryProfile
- Returns: `CostBreakdown[]` (one per vendor)

**Tool 3: `analyze_cardinality_impact`**
- Description: "Calculates the cost impact of adding a high-cardinality tag (like user_id or container_id) to metrics. Warns about time-series explosion."
- Input schema: TelemetryProfile + `proposed_tag: string` + `estimated_unique_values: number`
- Returns: `CardinalityAnalysis`

**Tool 4: `suggest_optimizations`**
- Description: "Suggests cost-saving optimizations for an observability setup — trace sampling, log retention adjustments, high-cardinality tag stripping — with estimated savings."
- Input schema: TelemetryProfile + `current_monthly_cost_usd: number`
- Returns: `OptimizationRecommendation[]` (ranked by savings)

## What to build in each file (Stage 1 — skeleton only)

**`packages/cost-engine/src/index.ts`:** Export stub functions matching the tool signatures above. Each returns hardcoded placeholder data with a TODO comment. We'll implement real pricing math in Stage 2.

**`packages/cost-engine/src/vendors/`:** Create one file per vendor (`datadog.ts`, `grafana-cloud.ts`, `aws-cloudwatch.ts`, `honeycomb.ts`) with an exported function like `calculateDatadogCost(profile: TelemetryProfile): CostBreakdown`. Stage 1: return zeros with a TODO.

**`apps/mcp-server/src/index.ts`:** Set up a minimal MCP server using the SDK. Register the 4 tools with proper input schemas (use zod). Wire stdio transport. Tool handlers should import from `@telemetryspend/cost-engine` (the workspace name) and return placeholder responses.

Sample structure:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
// import { estimateCost, compareVendors, ... } from '@telemetryspend/cost-engine';

const server = new Server(
  { name: 'telemetryspend', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

// Register tool list handler + tool call handler here
// Connect stdio transport
```

**`apps/web/app/page.tsx`:** Landing page with:
- Hero: "TelemetrySpend — Estimate your observability bill before your vendor does"
- Subheading explaining what it does
- CTA button that leads to `/calculator`

**`apps/web/app/calculator/page.tsx`:** The main calculator UI. For Stage 1, render:
- A form section with placeholder sliders for log volume, trace retention, sampling rate, cardinality dimensions
- Three preset buttons ("Small Startup", "Scale-Up SaaS", "Enterprise") that don't do anything yet
- A results section showing a placeholder Recharts stacked bar chart with dummy data
- A placeholder "Optimization Recommendations" section

**`apps/web/components/`:** Create stub components:
- `TelemetryProfileForm.tsx` — the input form
- `VendorComparisonChart.tsx` — the Recharts visual
- `OptimizationCard.tsx` — a single recommendation card
- `CardinalityWarning.tsx` — the "time-series explosion" warning UI
- `PresetSelector.tsx` — the three quick-start buttons

Each renders a labeled placeholder so I can see the layout without real data.

## Design direction

Clean, technical, developer-focused. Think Datadog docs or Vercel dashboard, not marketing landing page. Dark mode preferred (developers live in dark mode). Monospace for numbers. Use color sparingly — red only for cardinality warnings, green only for savings amounts. No emojis in the UI.

## What to skip in Stage 1

- Real vendor pricing math (Stage 2)
- Real cardinality calculations (Stage 2)
- Real optimization recommendations (Stage 3)
- MCP tool implementations beyond stubs (Stage 2)
- Deployment configuration for Vercel (Stage 4)
- MCP server installation instructions / Claude Desktop config docs (Stage 4)
- Any evaluation harness (Stage 4)

## Deliverable for Stage 1

A working monorepo where:
1. `npm install` at the root installs all workspace dependencies
2. `npm run dev --workspace=apps/web` starts the Next.js app cleanly on localhost:3000
3. The landing page renders, the calculator page renders with placeholder UI
4. `npm run build --workspace=apps/mcp-server` compiles the MCP server without errors
5. Running `node apps/mcp-server/dist/index.js` starts an MCP server that responds to the standard `tools/list` request over stdio with the 4 tool schemas
6. `tsc --noEmit` passes across all workspaces
7. `packages/cost-engine` can be imported from both apps

Once this skeleton runs cleanly, we'll move to Stage 2: implementing the
real pricing math for Datadog (first vendor) and wiring it through both the
web UI and the MCP `estimate_observability_cost` tool so you have one
vendor working end-to-end before we scale to the other three.

## One quick verification for me

After Claude Code scaffolds this, please share:
1. The final root `package.json` so I can verify workspace config
2. Any decisions Claude Code made that differ from the spec above (e.g. if
   it chose a different MCP SDK version or added a dependency I didn't
   specify)
3. Whether `npm run build --workspace=apps/mcp-server` produces a working
   stdio server (you can test with: `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node apps/mcp-server/dist/index.js`)

That gives me what I need to write the Stage 2 brief cleanly.

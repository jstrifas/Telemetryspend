# TelemetrySpend

Interactive observability cost calculator. Describe your telemetry profile (log volume, trace
retention, sampling, metric cardinality) and compare monthly cost across Datadog, Grafana Cloud,
AWS CloudWatch, and Honeycomb, including the series explosion caused by high-cardinality tags.

Two surfaces share one cost engine:

| Package | What it is |
| --- | --- |
| `packages/cost-engine` | Pure TypeScript pricing and cardinality logic (only runtime dependency: zod) |
| `apps/web` | Next.js calculator UI (App Router, Tailwind, Recharts) |
| `apps/mcp-server` | Stdio MCP server exposing the engine as 4 tools |

> **Status: Stage 3 (minimal).** Datadog and AWS CloudWatch pricing and the three-scenario
> cardinality model are implemented end to end. Grafana Cloud and Honeycomb return $0 until Stage 4.

## Getting started

Requires Node 20.9+.

```bash
npm install
npm run dev                 # web app on http://localhost:3000
npm run typecheck           # tsc --noEmit in every workspace
npm run build               # builds the web app and MCP server
```

### MCP server

```bash
npm run build --workspace=apps/mcp-server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node apps/mcp-server/dist/index.js
```

Tools: `estimate_observability_cost`, `compare_vendors`, `analyze_cardinality_impact`,
`suggest_optimizations`.

### Using it from Claude Desktop

1. Build the server:

   ```bash
   npm run build --workspace=apps/mcp-server
   ```

2. Copy the `telemetryspend` entry from
   [`claude_desktop_config.example.json`](claude_desktop_config.example.json) and replace
   `/ABSOLUTE/PATH/TO/telemetryspend` with the absolute path to this repo. On Windows, use
   forward slashes or escaped backslashes (`C:/Users/you/telemetryspend/...`).
3. Merge it into the `mcpServers` object of your existing `claude_desktop_config.json`:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
4. Fully quit and restart Claude Desktop.
5. Ask Claude something like: *"Estimate my Datadog cost for 100 GB/day of logs with 30-day
   retention and 10M spans a day at 10% sampling."*

## Pricing model

Datadog rates live in
[`packages/cost-engine/src/vendors/datadog-pricing.ts`](packages/cost-engine/src/vendors/datadog-pricing.ts).
They are approximations for planning, not a quote: actual cost depends on commitment tier,
negotiated rates, and product mix.

Metric cost is driven by the cardinality model in
[`cardinality.ts`](packages/cost-engine/src/cardinality.ts): each low-cardinality dimension
contributes ~10 values, and each high-cardinality tag multiplies the series count by its
unique values (from the scale hints, or 1,000 when no hint applies).

## How the cost engine is shared

`@telemetryspend/cost-engine` is published inside the workspace as TypeScript source (its
`exports` point at `src/index.ts`), so there is no separate build step for it:

- `apps/web` compiles it via Next's `transpilePackages`.
- `apps/mcp-server` bundles it into `dist/index.js` with tsup; the MCP SDK and zod stay external.

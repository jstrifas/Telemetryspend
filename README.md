# TelemetrySpend

**An observability cost calculator that shows you what your Datadog and CloudWatch bill *could* be — including the tail risk most calculators hide.**

🔗 **Live demo:** [telemetryspend-git-main-jstrifa-bits-projects.vercel.app/calculator](https://telemetryspend-git-main-jstrifa-bits-projects.vercel.app/calculator)

---

## What this is

TelemetrySpend is an interactive cost calculator that estimates monthly observability spend across Datadog and AWS CloudWatch (Grafana Cloud and Honeycomb planned). Developers input their telemetry profile — log volume, retention, metric cardinality, tag dimensions — and get three cost scenarios side by side: **Uncapped**, **Scoped**, and **Bounded**.

The differentiator isn't the calculator itself. Every vendor has one. The differentiator is what happens when you add a high-cardinality tag like `user_id`: TelemetrySpend shows you the difference between what you'd pay if that tag propagated across all your metrics (uncapped) versus if you scoped it disciplined (bounded). The delta between those two numbers — the **risk exposure** — is the actual product.

## What it looks like

The default profile — 50 GB/day of logs, `user_id` across 10,000 users — shows:

- **Bounded scope:** Datadog is cheapest at $25,931/mo
- **Scoped:** AWS CloudWatch is cheapest at $100,269/mo
- **Uncapped:** AWS CloudWatch is cheapest at $265,253/mo

The risk exposure between uncapped and bounded on Datadog alone: **$474,952/mo.**

That number is the point.

---

## Why this exists

Every observability vendor has a cost calculator. Every one of them models "typical" bills. None of them model **the tail risk** — the "what if we ship this tag without thinking" number that motivates the scoping decision.

The moment cardinality choices matter most is *before* deployment, when someone is about to add a tag and needs a reason to stop and think. Showing them $2,000 doesn't make them think. Showing them $500,000 does.

## Two architectural surfaces

TelemetrySpend has two ways to consume its cost engine:

1. **A Next.js web app** — the interactive UI with sliders, presets, live charts, and vendor comparison
2. **A stdio-transport MCP server** — exposes the same cost engine as tools any MCP client (Claude Desktop, Cursor) can call inline during development conversations

The second surface is deliberate. Observability cost questions happen *mid-workflow* — someone's about to add a tag, change a retention setting, or evaluate a vendor swap. Forcing them out to a web app breaks the flow. The MCP server means a developer can ask Claude *"what happens to my Datadog bill if I add `request_id` as a tag?"* and get a real answer inline, without context-switching.

Both surfaces share a single `packages/cost-engine` TypeScript library. That's the actual IP; the UI and MCP server are two ways to consume it.

## Key product decisions

**1. Three scenarios, not one.**
Most calculators model "typical" cost. TelemetrySpend models three: what you'd pay if 100% of metrics carry the high-cardinality tag (Uncapped), 25% (Scoped), and 5% (Bounded). The three-way spread is what turns a scary number into a decision aid.

**2. The delta between uncapped and bounded is the headline.**
Every vendor comparison callout leads with **risk exposure** — the dollar delta between disciplined and undisciplined cardinality. That number is what a platform engineer needs to justify the scoping work internally.

**3. Datadog vs. CloudWatch crossover is a structural insight, not a workload artifact.**
The tool surfaces that the two vendors cross over at ~1.6M custom metrics — a property of Datadog's flat $0.05/metric versus CloudWatch's tiered pricing, not a function of the customer's workload. This means vendor choice isn't about volume; it's about how disciplined you are with cardinality.

**4. Two charts, not one.**
Metrics and base costs (logs + traces) live on completely different scales — metrics can be hundreds of thousands of dollars while base costs are hundreds. Rendering them on the same axis compressed logs and traces into invisible slivers. Splitting them into two charts with independent stepped axes made both readable.

**5. Deliberate deferrals labeled visibly.**
Grafana Cloud and Honeycomb columns are shown in the UI with "$0 · Stage 4" labels. This isn't hiding — it's a roadmap signal. The architecture supports them; the pricing math hasn't been researched yet.

## Architecture

```
┌─────────────────────────────────────────────┐
│                                             │
│  packages/cost-engine (TypeScript library)  │
│                                             │
│  ├── vendors/                               │
│  │   ├── datadog.ts       (flat pricing)    │
│  │   └── aws-cloudwatch.ts (tiered pricing) │
│  ├── cardinality.ts       (3-scenario math) │
│  └── types.ts             (shared schema)   │
│                                             │
└──────────────┬──────────────────┬───────────┘
               │                  │
               ▼                  ▼
    ┌──────────────────┐  ┌──────────────────┐
    │                  │  │                  │
    │  apps/web        │  │ apps/mcp-server  │
    │  Next.js on      │  │ stdio MCP server │
    │  Vercel          │  │ 4 tools exposed  │
    │                  │  │                  │
    └──────────────────┘  └──────────────────┘
```

Monorepo, npm workspaces. TypeScript everywhere. Zod for runtime schema validation. Recharts for visualization. Tailwind for styling. The Anthropic MCP SDK for the stdio server.

### The 4 MCP tools

1. **`estimate_observability_cost`** — Full cost breakdown for a given vendor and telemetry profile
2. **`compare_vendors`** — Side-by-side comparison across all vendors with cheapest-per-scenario callout
3. **`analyze_cardinality_impact`** — What happens if you add a specific high-cardinality tag
4. **`suggest_optimizations`** — Placeholder for Stage 4

## What didn't work

**The first Datadog pricing math was wrong by a factor of 7.**
Initial implementation produced $15,619 for a 100 GB/day profile that should have been ~$2,166. Root cause: I'd confused Datadog's per-GB and per-million-events rates, and applied indexing costs to all logs instead of only the ~15% typically indexed. Fixed by rewriting the pricing constants with correct log-to-event ratios and an indexing percentage assumption. The lesson: for AI-assisted builds, the first version of any pricing model needs a hand-calculation sanity check before you build UI on top of it.

**The Recharts bars stopped updating when sliders moved.**
Numbers in the surrounding UI updated correctly, but the chart bars visually didn't change. Symptom looked like a state bug but turned out to be Recharts' auto-scaling Y-axis: with only one vendor showing real values, the axis rescaled to fit that vendor every time, so bars stayed visually identical even as their values grew. Fixed by splitting into two charts with independent stepped axes. This wasn't in the original spec — the fix emerged from the debugging process and became a better architectural decision than the original design.

**Claude Code fabricated optimization recommendations that looked real.**
An earlier version of the UI displayed two hardcoded optimization cards with specific dollar amounts ("Strip user_id from request metrics: -$3,400/mo") that weren't computed from the actual profile. These looked authoritative but were fabricated. Removed and replaced with an explicit "coming in Stage 4" empty state. The lesson: AI-generated placeholder content that looks real is worse than an obvious empty state, because it creates credibility risk the first time an interviewer notices the numbers don't respond to input.

**Prompt design was a bigger surface than expected.**
When I first designed the MCP tool schemas, I treated them as one-time setup. They weren't — the way each tool describes its inputs and outputs directly shapes how Claude decides when to invoke it. I iterated on tool descriptions and parameter naming as much as the pricing math. This mirrors a lesson from earlier work on Mission Cloud Score: prompt design is a continuous product surface, not setup work.

## Where this thinking goes next

TelemetrySpend is one piece of a broader thesis: **AI cost optimization is the next frontier of cloud cost optimization**, and the tools that surface it will need three things — visibility into the actual cost drivers, opinionated recommendations grounded in customer-specific context, and interfaces that meet developers where they already work (which increasingly means AI assistants, not dashboards).

The MCP integration in TelemetrySpend is a small first step at the third of those. A developer in an IDE can ask Claude a natural-language question about their observability cost and Claude calls the tool inline. Extending that pattern to broader cloud cost work — LLM token economics, inference routing, prompt-level cost drivers — is where I'm exploring next.

## Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts
- **Backend:** Next.js API routes
- **MCP Server:** `@modelcontextprotocol/sdk` v1.30, stdio transport, tsup bundler
- **Monorepo:** npm workspaces
- **Deployment:** Vercel
- **Build assistance:** Claude Code

## Timeline

Built in ~3 weekends. All pricing math anchored to published vendor rates. Not affiliated with Datadog, AWS, Grafana Labs, or Honeycomb.

## Roadmap

- **Stage 4:** Grafana Cloud pricing, Honeycomb pricing, real optimization recommendations engine, preset button wiring, markdown export

## About the author

Built by John Strifas — Senior Product Manager focused on enterprise generative AI, 0→1 SaaS launches, and cloud cost optimization. Previously founding PM at Mission Cloud (built Mission Cloud Score, the automated AWS optimization scorecard that drove 22% average customer cost reduction). Currently at AWS.

📄 [Mission Cloud Score case study](../mission-cloud-score-case-study) · 💼 [LinkedIn](https://www.linkedin.com/in/YOUR-HANDLE) · 📧 jstrifa@gmail.com

---

*Estimates use published vendor pricing (subject to change). Not affiliated with Datadog, AWS, Grafana Labs, or Honeycomb. Educational planning tool — not a quote.*

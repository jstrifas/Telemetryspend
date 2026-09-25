'use client';

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IMPLEMENTED_VENDORS, VENDOR_LABELS, type CostBreakdown } from '@telemetryspend/cost-engine';
import { formatCount, formatUsd, formatUsdCompact, formatUsdShort } from '@/lib/format';
import { SCENARIOS } from '@/lib/scenarios';

// Two charts on independent scales: metrics per cardinality scenario (driven
// by tags and scope ratios), and base costs (logs + traces, driven by the
// volume sliders and identical across scenarios). On one shared scale an
// uncapped metrics bill would flatten logs and traces to a few pixels.

const BASE_SERIES = [
  { key: 'logs', name: 'Logs', fill: '#3b82f6' }, // Tailwind blue-500
  { key: 'traces', name: 'Traces', fill: '#a855f7' }, // Tailwind purple-500
] as const;

const BAR_GAP = 3;
const GRID = '#26262a';
const AXIS_TEXT = '#a1a1aa'; // muted
const FAINT_TEXT = '#80808a'; // faint

interface ChartRow {
  name: string;
  implemented: boolean;
  breakdown: CostBreakdown;
  /** Uncapped minus bounded total; null for vendors without a pricing model. */
  riskExposure: number | null;
  // Base total, carried by whichever segment is on top: Recharts skips
  // labels on zero-height bars (CloudWatch has no traces).
  baseLabelOnLogs: string;
  baseLabelOnTraces: string;
  logs: number;
  traces: number;
  uncapped_metrics: number;
  scoped_metrics: number;
  bounded_metrics: number;
}

function toRow(breakdown: CostBreakdown): ChartRow {
  const implemented = IMPLEMENTED_VENDORS.includes(breakdown.vendor);
  const riskExposureUsd = breakdown.totals.uncapped_usd - breakdown.totals.bounded_usd;
  const baseLabel = implemented ? formatUsdShort(breakdown.logs_usd + breakdown.traces_usd) : '';
  return {
    name: VENDOR_LABELS[breakdown.vendor],
    implemented,
    breakdown,
    riskExposure: implemented ? riskExposureUsd : null,
    baseLabelOnLogs: breakdown.traces_usd > 0 ? '' : baseLabel,
    baseLabelOnTraces: breakdown.traces_usd > 0 ? baseLabel : '',
    logs: breakdown.logs_usd,
    traces: breakdown.traces_usd,
    uncapped_metrics: breakdown.metrics.uncapped_usd,
    scoped_metrics: breakdown.metrics.scoped_usd,
    bounded_metrics: breakdown.metrics.bounded_usd,
  };
}

/**
 * Axis max stepped to 1 / 2 / 5 x 10^n. Recharts' auto domain fits the tallest
 * bar tightly, so with a single priced vendor that bar never changes height;
 * a stepped max holds still between steps and lets bars visibly move.
 */
function steppedAxis(maxValue: number): { domain: [number, number]; ticks: number[] } {
  let max = 1;
  if (maxValue > 0) {
    const magnitude = 10 ** Math.floor(Math.log10(maxValue));
    max = [1, 2, 5, 10].map((step) => step * magnitude).find((candidate) => maxValue <= candidate) ?? 10 * magnitude;
  }
  return { domain: [0, max], ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => f * max) };
}

// Vendor name, plus a second line for vendors whose pricing isn't implemented
// yet (their zero-height bars can't carry a label).
function VendorTick({ x, y, payload, rows }: { x?: number; y?: number; payload?: { value: string }; rows: ChartRow[] }) {
  const row = rows.find((r) => r.name === payload?.value);
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={12}>
      <tspan x={x} dy={14} fill={AXIS_TEXT}>
        {payload?.value}
      </tspan>
      {row && !row.implemented && (
        <tspan x={x} dy={16} fill={FAINT_TEXT} fontSize={11}>
          $0 · Stage 4
        </tspan>
      )}
    </text>
  );
}

// Drawn from the first (uncapped) bar, centered over the vendor's three bars
// and pinned to the top of the plot so it never collides with a bar. Narrow
// groups get a short form so neighboring labels don't overlap.
function RiskLabel(props: { x?: number | string; width?: number | string; value?: unknown }) {
  const x = Number(props.x);
  const width = Number(props.width);
  const risk = typeof props.value === 'number' ? props.value : null;
  if (risk === null || !Number.isFinite(x) || !Number.isFinite(width)) return null;
  const groupWidth = 3 * width + 2 * BAR_GAP;
  const groupCenter = x + groupWidth / 2;
  // Bars shrink below their 40px cap only when vendor columns get narrow.
  const text = width >= 30 ? `Risk exposure: ${formatUsdShort(risk)}` : `Risk ${formatUsdCompact(risk)}`;
  return (
    <text x={groupCenter} y={14} textAnchor="middle" fontSize={12} fill="#ededef" fontFamily="var(--font-geist-mono)">
      {text}
    </text>
  );
}

function LegendItems({ items }: { items: readonly { key: string; label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <span key={item.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: ChartRow }> };

function TooltipFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-sm rounded-md border border-line bg-surface p-3 text-xs shadow-lg">
      <p className="font-medium text-fg">{title}</p>
      {children}
    </div>
  );
}

function MetricsTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const { breakdown } = row;

  return (
    <TooltipFrame title={`${row.name} · metrics`}>
      <table className="tabular mt-2 w-full font-mono">
        <thead>
          <tr className="font-sans text-faint">
            <th className="text-left font-normal">Scenario</th>
            <th className="text-right font-normal">Series</th>
            <th className="text-right font-normal">Cost</th>
          </tr>
        </thead>
        <tbody>
          {SCENARIOS.map((scenario) => (
            <tr key={scenario.key}>
              <td className={`pt-1 font-sans ${scenario.textClass}`}>{scenario.label}</td>
              <td className="pt-1 pl-3 text-right text-fg">
                {formatCount(breakdown.cardinality[`${scenario.key}_series`])}
              </td>
              <td className="pt-1 pl-3 text-right text-fg">{formatUsd(breakdown.metrics[`${scenario.key}_usd`])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {row.implemented && (
        <p className="mt-2 border-t border-line pt-1.5 font-mono text-fg">
          <span className="font-sans text-muted">Risk exposure </span>
          {formatUsd(breakdown.metrics.uncapped_usd - breakdown.metrics.bounded_usd)}
        </p>
      )}
    </TooltipFrame>
  );
}

function BaseTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const { breakdown } = row;

  return (
    <TooltipFrame title={`${row.name} · logs + traces`}>
      <dl className="tabular mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono">
        {BASE_SERIES.map((series) => (
          <div key={series.key} className="contents">
            <dt className="flex items-center gap-1.5 font-sans text-muted">
              <span className="h-2 w-2 rounded-sm" style={{ background: series.fill }} />
              {series.name}
            </dt>
            <dd className="text-right text-fg">{formatUsd(row[series.key])}</dd>
          </div>
        ))}
        <dt className="border-t border-line pt-1 font-sans text-muted">Total</dt>
        <dd className="border-t border-line pt-1 text-right text-fg">
          {formatUsd(breakdown.logs_usd + breakdown.traces_usd)}
        </dd>
      </dl>
    </TooltipFrame>
  );
}

function ChartTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h3 className="text-sm font-medium text-fg">{title}</h3>
      <p className="text-xs text-faint">{detail}</p>
    </div>
  );
}

export function VendorComparisonChart({ data }: { data: CostBreakdown[] }) {
  const rows = data.map(toRow);
  const notes = rows.filter((row) => row.implemented).flatMap((row) => row.breakdown.notes.map((note) => `${row.name}: ${note}`));

  const metricsAxis = steppedAxis(
    Math.max(...rows.flatMap((row) => [row.uncapped_metrics, row.scoped_metrics, row.bounded_metrics])),
  );
  const baseAxis = steppedAxis(Math.max(...rows.map((row) => row.logs + row.traces)));

  const xAxisProps = {
    dataKey: 'name',
    tick: <VendorTick rows={rows} />,
    interval: 0,
    height: 44,
    axisLine: { stroke: GRID },
    tickLine: false,
  } as const;

  const yAxisProps = {
    tickFormatter: (v: number) => formatUsdCompact(v),
    tick: { fill: AXIS_TEXT, fontSize: 12, fontFamily: 'var(--font-geist-mono)' },
    axisLine: false,
    tickLine: false,
    width: 56,
    allowDecimals: false,
  } as const;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <ChartTitle title="Metrics by cardinality scenario" detail="Moves with tags, scale hints, and scope ratios" />
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 28, right: 8, bottom: 0, left: 8 }} barGap={BAR_GAP} barCategoryGap="18%">
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} domain={metricsAxis.domain} ticks={metricsAxis.ticks} />
              <Tooltip cursor={{ fill: '#18181b' }} content={MetricsTooltip} isAnimationActive={false} />
              {SCENARIOS.map((scenario, index) => (
                <Bar
                  key={scenario.key}
                  dataKey={`${scenario.key}_metrics`}
                  name={scenario.label}
                  fill={scenario.color}
                  maxBarSize={40}
                  isAnimationActive={false}
                >
                  {index === 0 && <LabelList dataKey="riskExposure" content={RiskLabel} />}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <LegendItems items={SCENARIOS.map((s) => ({ key: s.key, label: s.label, color: s.color }))} />
      </div>

      <div className="space-y-3 border-t border-line pt-6">
        <ChartTitle title="Base costs: logs + traces" detail="Same in every scenario · moves with the volume sliders" />
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 8 }} barCategoryGap="30%">
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} domain={baseAxis.domain} ticks={baseAxis.ticks} />
              <Tooltip cursor={{ fill: '#18181b' }} content={BaseTooltip} isAnimationActive={false} />
              {BASE_SERIES.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.name}
                  stackId="base"
                  fill={series.fill}
                  maxBarSize={56}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey={series.key === 'logs' ? 'baseLabelOnLogs' : 'baseLabelOnTraces'}
                    position="top"
                    fill="#ededef"
                    fontSize={12}
                    fontFamily="var(--font-geist-mono)"
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <LegendItems items={BASE_SERIES.map((s) => ({ key: s.key, label: s.name, color: s.fill }))} />
      </div>

      {notes.length > 0 && (
        <details className="group border-t border-line pt-3 text-xs">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="h-3 w-3 fill-current transition-transform group-open:rotate-90"
            >
              <path d="M6 3.5 10.5 8 6 12.5V3.5Z" />
            </svg>
            Assumptions and caveats ({notes.length})
          </summary>
          <ul className="mt-2 space-y-1 pl-4 text-muted">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

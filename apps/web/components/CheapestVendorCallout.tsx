import {
  METRICS_PRICING_SUMMARY,
  VENDOR_COVERAGE_GAPS,
  VENDOR_LABELS,
  formatSeries,
  type Vendor,
  type VendorComparison,
} from '@telemetryspend/cost-engine';
import { formatUsd } from '@/lib/format';
import { SCENARIOS } from '@/lib/scenarios';

function WarningIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 fill-current">
      <path d="M10 2.5 1.5 17h17L10 2.5Zm-.9 5h1.8v5h-1.8v-5Zm0 6.5h1.8v1.8h-1.8V14Z" />
    </svg>
  );
}

export function CheapestVendorCallout({ comparison }: { comparison: VendorComparison }) {
  const { cheapest_by_scenario: cheapest, metrics_crossover_series: crossover, vendors } = comparison;
  const totalFor = (vendor: Vendor, key: `${(typeof SCENARIOS)[number]['key']}_usd`) =>
    vendors.find((b) => b.vendor === vendor)?.totals[key] ?? 0;

  const lowCardinalityWinner = cheapest.bounded;
  const highCardinalityWinner = cheapest.uncapped;
  const diverges = new Set(Object.values(cheapest)).size > 1;
  const gaps = [...new Set(Object.values(cheapest))]
    .filter((vendor) => VENDOR_COVERAGE_GAPS[vendor])
    .map((vendor) => `${VENDOR_LABELS[vendor]} ${VENDOR_COVERAGE_GAPS[vendor]}.`);

  const rows = (
    <dl className="tabular mt-3 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 gap-y-1.5 text-sm">
      {SCENARIOS.map((scenario) => {
        const vendor = cheapest[scenario.key];
        return (
          <div key={scenario.key} className="contents">
            <dt className={scenario.textClass}>{scenario.label}</dt>
            <dd className="text-fg">{VENDOR_LABELS[vendor]}</dd>
            <dd className="text-right font-mono text-fg">{formatUsd(totalFor(vendor, `${scenario.key}_usd`))}</dd>
          </div>
        );
      })}
    </dl>
  );

  if (!diverges) {
    return (
      <section aria-label="Cheapest vendor" className="rounded-lg border border-line px-4 py-3 text-sm text-muted">
        <p>
          Cheapest across all scenarios: <span className="text-fg">{VENDOR_LABELS[lowCardinalityWinner]}</span>{' '}
          (<span className="tabular font-mono text-fg">{formatUsd(totalFor(lowCardinalityWinner, 'bounded_usd'))}</span>{' '}
          at bounded scope).
        </p>
        {gaps.length > 0 && <p className="mt-1 text-xs text-faint">{gaps.join(' ')}</p>}
      </section>
    );
  }

  // The crossover is fixed by the two price schedules; where this profile's
  // scenarios sit relative to it is what moves with the inputs.
  const series = vendors.find((b) => b.vendor === lowCardinalityWinner)?.cardinality;

  return (
    <section role="status" className="rounded-lg border border-amber-400/50 bg-amber-400/[0.06] p-5">
      <div className="flex items-start gap-2 text-amber-300">
        <WarningIcon />
        <h2 className="text-base font-semibold">Vendor choice depends on cardinality discipline</h2>
      </div>
      {rows}
      <div className="mt-4 space-y-2 border-t border-amber-400/20 pt-3 text-sm text-muted">
        <p>
          <span className="text-fg">{VENDOR_LABELS[lowCardinalityWinner]}</span> is cheaper while high-cardinality
          tags stay tightly bounded; <span className="text-fg">{VENDOR_LABELS[highCardinalityWinner]}</span> is cheaper once
          they spread.
          {METRICS_PRICING_SUMMARY[lowCardinalityWinner] && METRICS_PRICING_SUMMARY[highCardinalityWinner] && (
            <>
              {' '}
              {VENDOR_LABELS[lowCardinalityWinner]} charges {METRICS_PRICING_SUMMARY[lowCardinalityWinner]};{' '}
              {VENDOR_LABELS[highCardinalityWinner]} is {METRICS_PRICING_SUMMARY[highCardinalityWinner]}.
            </>
          )}
        </p>
        {crossover !== null && (
          <p>
            Metrics costs cross over at{' '}
            <span className="font-mono text-fg">~{formatSeries(crossover)}</span> series.
            {series && (
              <>
                {' '}
                This profile&apos;s bounded scenario has{' '}
                <span className="font-mono text-fg">{formatSeries(series.bounded_series)}</span>; uncapped has{' '}
                <span className="font-mono text-fg">{formatSeries(series.uncapped_series)}</span>.
              </>
            )}
          </p>
        )}
        {gaps.length > 0 && <p className="text-xs text-faint">{gaps.join(' ')}</p>}
      </div>
    </section>
  );
}

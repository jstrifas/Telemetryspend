import { IMPLEMENTED_VENDORS, VENDOR_LABELS, type CostBreakdown, type VendorComparison } from '@telemetryspend/cost-engine';
import { formatUsd } from '@/lib/format';
import { SCENARIOS } from '@/lib/scenarios';

// One exact figure per vendor and scenario. Color stays on the scenario
// headers; the cheapest vendor in each column is the only emphasized cell.
export function VendorTotalsTable({ comparison }: { comparison: VendorComparison }) {
  const priced: CostBreakdown[] = comparison.vendors.filter((b) => IMPLEMENTED_VENDORS.includes(b.vendor));
  const compared = priced.length > 1;

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="tabular w-full text-xs sm:whitespace-nowrap sm:text-sm">
        <caption className="sr-only">
          Monthly cost per vendor and cardinality scenario{compared ? '; the cheapest vendor per scenario is marked' : ''}
        </caption>
        <thead>
          <tr className="text-xs text-muted">
            <th scope="col" className="pb-2 pr-4 text-left font-normal">
              Vendor
            </th>
            <th scope="col" className="hidden pb-2 pl-4 text-right font-normal sm:table-cell">
              Logs
            </th>
            <th scope="col" className="hidden pb-2 pl-4 text-right font-normal sm:table-cell">
              Traces
            </th>
            {SCENARIOS.map((scenario) => (
              <th key={scenario.key} scope="col" className="whitespace-nowrap pb-2 pl-2 text-right font-normal sm:pl-4">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: scenario.color }} />
                  {scenario.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono">
          {priced.map((breakdown) => (
            <tr key={breakdown.vendor} className="border-t border-line">
              <th scope="row" className="py-2.5 pr-2 text-left font-sans font-normal text-fg sm:pr-4">
                {VENDOR_LABELS[breakdown.vendor]}
              </th>
              <td className="hidden py-2.5 pl-4 text-right text-muted sm:table-cell">{formatUsd(breakdown.logs_usd)}</td>
              <td className="hidden py-2.5 pl-4 text-right text-muted sm:table-cell">{formatUsd(breakdown.traces_usd)}</td>
              {SCENARIOS.map((scenario) => {
                const cheapest = compared && comparison.cheapest_by_scenario[scenario.key] === breakdown.vendor;
                return (
                  <td key={scenario.key} className="whitespace-nowrap py-1.5 pl-2 text-right sm:pl-4">
                    <span
                      className={`inline-block rounded px-1.5 py-1 ${
                        cheapest ? 'bg-white/[0.08] font-semibold text-fg' : 'text-muted'
                      }`}
                    >
                      {formatUsd(breakdown.totals[`${scenario.key}_usd`])}
                      {cheapest && <span className="sr-only"> (cheapest)</span>}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {compared && <p className="mt-2 text-xs text-faint">Highlighted: cheapest vendor in each scenario.</p>}
    </div>
  );
}

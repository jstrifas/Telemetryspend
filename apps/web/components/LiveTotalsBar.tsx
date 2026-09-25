import { IMPLEMENTED_VENDORS, VENDOR_LABELS, type CostBreakdown } from '@telemetryspend/cost-engine';
import { formatUsdShort } from '@/lib/format';

// Narrow screens stack the results below the whole form, out of view while a
// slider moves. This bar keeps the headline totals on screen and jumps to the
// full breakdown.
export function LiveTotalsBar({ data }: { data: CostBreakdown[] }) {
  const priced = data.filter((breakdown) => IMPLEMENTED_VENDORS.includes(breakdown.vendor));

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas/95 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur md:hidden">
      <table aria-live="polite" className="tabular w-full text-xs">
        <caption className="sr-only">Monthly totals</caption>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="text-left font-normal">
              <a
                href="#results"
                className="text-fg underline decoration-line underline-offset-4 transition-colors hover:decoration-fg"
              >
                View breakdown
              </a>
            </th>
            <th scope="col" className="text-right font-normal text-green-400">
              Bounded
            </th>
            <th scope="col" className="text-right font-normal text-red-400">
              Uncapped
            </th>
          </tr>
        </thead>
        <tbody className="font-mono text-fg">
          {priced.map((breakdown) => (
            <tr key={breakdown.vendor}>
              <th scope="row" className="pt-1 text-left font-sans font-normal text-muted">
                {VENDOR_LABELS[breakdown.vendor]}
              </th>
              <td className="pt-1 text-right">{formatUsdShort(breakdown.totals.bounded_usd)}</td>
              <td className="pt-1 text-right">{formatUsdShort(breakdown.totals.uncapped_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

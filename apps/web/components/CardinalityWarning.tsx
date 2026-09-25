import type { CardinalityAnalysis, CardinalityScenarios } from '@telemetryspend/cost-engine';
import { formatCount, formatUsd } from '@/lib/format';
import { SCENARIOS } from '@/lib/scenarios';

const LEVEL_STYLES: Record<CardinalityAnalysis['warning_level'], { box: string; accent: string; title: string }> = {
  safe: {
    box: 'border-green-500/40 bg-green-500/5',
    accent: 'text-green-400',
    title: 'Cardinality within safe range',
  },
  caution: {
    box: 'border-yellow-500/40 bg-yellow-500/5',
    accent: 'text-yellow-400',
    title: 'High cardinality',
  },
  severe: {
    box: 'border-red-500/40 bg-red-500/5',
    accent: 'text-red-400',
    title: 'Time-series explosion',
  },
};

interface CardinalityWarningProps {
  tag: string;
  analysis: CardinalityAnalysis;
  /** Fraction of metrics carrying the tag in each scenario. */
  ratios: CardinalityScenarios;
}

export function CardinalityWarning({ tag, analysis, ratios }: CardinalityWarningProps) {
  const style = LEVEL_STYLES[analysis.warning_level];

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <div role={analysis.warning_level === 'safe' ? 'status' : 'alert'} className={`border-b p-4 ${style.box}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={`text-sm font-medium ${style.accent}`}>
            {style.title}: <code className="font-mono">{tag}</code> multiplies every series it touches{' '}
            <span className="tabular font-mono">{formatCount(analysis.multiplier)}x</span>
          </p>
          <span className={`font-mono text-xs uppercase tracking-wider ${style.accent}`}>{analysis.warning_level}</span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Without <code className="font-mono">{tag}</code>:{' '}
          <span className="tabular font-mono text-fg">{formatCount(analysis.base_series_count)}</span> series
        </p>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="tabular w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-2 font-normal">Scenario</th>
              <th className="pb-2 text-right font-normal">Metrics tagged</th>
              <th className="pb-2 text-right font-normal">Series count</th>
              <th className="pb-2 text-right font-normal">Added monthly cost (Datadog)</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {SCENARIOS.map((scenario) => {
              const impact = analysis.scenarios[scenario.key];
              return (
                <tr key={scenario.key} className="border-t border-line">
                  <td className={`py-2 font-sans ${scenario.textClass}`}>{scenario.label}</td>
                  <td className="py-2 text-right text-muted">{Math.round(ratios[scenario.key] * 100)}%</td>
                  <td className="py-2 text-right">{formatCount(impact.series_count)}</td>
                  <td className="py-2 text-right">+{formatUsd(impact.monthly_cost_delta_usd)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-4">
          <span className="text-sm text-muted">Risk exposure (uncapped − bounded)</span>
          <span className="tabular font-mono text-xl font-semibold text-fg">
            {formatUsd(analysis.risk_exposure_usd)}/mo
          </span>
        </p>
      </div>
    </section>
  );
}

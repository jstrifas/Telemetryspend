import type { OptimizationRecommendation } from '@telemetryspend/cost-engine';

export function OptimizationCard({ recommendation }: { recommendation: OptimizationRecommendation }) {
  const { title, description, category, effort, tradeoffs, estimated_monthly_savings_usd } = recommendation;

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-faint">{category}</p>
          <h3 className="mt-1 text-sm font-medium">{title}</h3>
        </div>
        <p className="tabular shrink-0 font-mono text-sm text-savings">
          -${estimated_monthly_savings_usd.toLocaleString()}/mo
        </p>
      </div>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-faint">Effort</dt>
        <dd className="font-mono text-muted">{effort}</dd>
        <dt className="text-faint">Tradeoff</dt>
        <dd className="text-muted">{tradeoffs}</dd>
      </dl>
    </article>
  );
}

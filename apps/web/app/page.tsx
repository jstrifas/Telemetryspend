import Link from 'next/link';
import { VENDORS, VENDOR_LABELS } from '@telemetryspend/cost-engine';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="py-20 sm:py-28">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">TelemetrySpend</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Estimate your observability bill before your vendor does
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Describe your telemetry profile (log volume, trace retention, sampling rate, metric cardinality) and
          compare monthly cost across vendors. See how a single high-cardinality tag like{' '}
          <code className="font-mono text-fg">user_id</code> multiplies your metric series before it reaches
          production.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/calculator"
            className="rounded-md bg-fg px-4 py-2.5 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
          >
            Open the calculator
          </Link>
          <span className="text-sm text-muted">
            Also available as an MCP server for Claude Desktop, Cursor, and other MCP clients.
          </span>
        </div>
      </section>

      <section className="border-t border-line py-10">
        <p className="text-xs uppercase tracking-widest text-faint">Vendors compared</p>
        <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2 font-mono text-sm text-muted">
          {VENDORS.map((vendor) => (
            <li key={vendor}>{VENDOR_LABELS[vendor]}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

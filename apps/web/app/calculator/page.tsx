'use client';

import { useMemo, useState } from 'react';
import {
  analyzeCardinalityImpact,
  buildVendorComparison,
  cardinalityScopeRatios,
  estimateUniqueValues,
  type TelemetryProfile,
} from '@telemetryspend/cost-engine';
import { CardinalityWarning } from '@/components/CardinalityWarning';
import { CheapestVendorCallout } from '@/components/CheapestVendorCallout';
import { LiveTotalsBar } from '@/components/LiveTotalsBar';
import { PresetSelector } from '@/components/PresetSelector';
import { TelemetryProfileForm } from '@/components/TelemetryProfileForm';
import { VendorComparisonChart } from '@/components/VendorComparisonChart';
import { VendorTotalsTable } from '@/components/VendorTotalsTable';
import { DEFAULT_PRESET_ID, PRESETS, type PresetId } from '@/lib/presets';

const presetProfile = (id: PresetId): TelemetryProfile => PRESETS.find((preset) => preset.id === id)!.profile;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-fg">{children}</h2>;
}

export default function CalculatorPage() {
  // Starts on a preset with user_id preloaded, so the first view shows the
  // uncapped / scoped / bounded spread.
  const [profile, setProfile] = useState<TelemetryProfile>(() => presetProfile(DEFAULT_PRESET_ID));
  const [activePreset, setActivePreset] = useState<PresetId | null>(DEFAULT_PRESET_ID);

  const selectPreset = (id: PresetId) => {
    setProfile(presetProfile(id));
    setActivePreset(id);
  };

  // Any manual edit leaves the preset.
  const editProfile = (next: TelemetryProfile) => {
    setProfile(next);
    setActivePreset(null);
  };

  // Datadog and CloudWatch are priced; Grafana Cloud and Honeycomb return zeros until Stage 4.
  const comparison = useMemo(() => buildVendorComparison(profile), [profile]);
  const costs = comparison.vendors;

  // The most recently selected high-cardinality tag is treated as the proposed change.
  const cardinality = useMemo(() => {
    const proposedTag = profile.high_cardinality_tags.at(-1);
    if (!proposedTag) return null;
    const uniqueValues = estimateUniqueValues(proposedTag, profile);
    return { tag: proposedTag, analysis: analyzeCardinalityImpact(profile, proposedTag, uniqueValues) };
  }, [profile]);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-8 pb-28 sm:px-6 md:pb-8">
      <LiveTotalsBar data={costs} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Cost calculator</h1>
        <p className="font-mono text-xs text-faint">stage 3 · datadog + cloudwatch</p>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-[300px_1fr] lg:grid-cols-[360px_1fr]">
        {/* Pinned with its own scroll so the results stay in view while any slider moves. */}
        <aside className="space-y-8 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start md:overflow-y-auto md:pr-1">
          <section className="space-y-3">
            <SectionHeading>Quick start</SectionHeading>
            <PresetSelector activeId={activePreset} onSelect={selectPreset} />
          </section>
          <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
            <SectionHeading>Telemetry profile</SectionHeading>
            <TelemetryProfileForm profile={profile} onChange={editProfile} />
          </section>
        </aside>

        <div id="results" className="min-w-0 scroll-mt-4 space-y-8">
          <CheapestVendorCallout comparison={comparison} />

          <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
            <div>
              <SectionHeading>Monthly cost by vendor</SectionHeading>
              <p className="mt-1 text-xs text-faint">Planning estimates from public list prices, not quotes.</p>
            </div>
            <VendorTotalsTable comparison={comparison} />
            <div className="border-t border-line pt-6">
              <VendorComparisonChart data={costs} />
            </div>
          </section>

          {cardinality && (
            <CardinalityWarning
              tag={cardinality.tag}
              analysis={cardinality.analysis}
              ratios={cardinalityScopeRatios(profile)}
            />
          )}

          <section className="space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <SectionHeading>Optimization recommendations</SectionHeading>
              <p className="font-mono text-xs text-faint">coming in Stage 4</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-dashed border-line p-5 md:col-span-2">
                <p className="text-sm font-medium text-muted">Not yet computed.</p>
                <p className="mt-2 max-w-prose text-sm text-faint">
                  This section will suggest cardinality stripping, sampling adjustments, and retention tuning based on
                  your current telemetry profile. Real recommendations with computed savings arrive in Stage 4.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

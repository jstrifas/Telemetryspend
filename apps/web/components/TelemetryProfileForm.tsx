'use client';

import {
  DEFAULT_HIGH_CARDINALITY_VALUES,
  cardinalityScopeRatios,
  type CardinalityScenario,
  type TelemetryProfile,
} from '@telemetryspend/cost-engine';
import { formatCompact, formatCount } from '@/lib/format';
import { SCENARIOS } from '@/lib/scenarios';

const SCOPE_FIELDS = {
  uncapped: 'cardinality_scope_uncapped',
  scoped: 'cardinality_scope_scoped',
  bounded: 'cardinality_scope_bounded',
} as const satisfies Record<CardinalityScenario, keyof TelemetryProfile>;

const LOW_CARDINALITY_DIMENSIONS = ['service', 'env', 'region', 'cluster', 'namespace', 'availability_zone'];
const HIGH_CARDINALITY_TAGS = ['user_id', 'container_id', 'endpoint', 'request_id', 'session_id', 'trace_id'];

type ScaleHintKey = 'unique_users_per_month' | 'unique_containers' | 'unique_endpoints';

const SCALE_HINTS: { key: ScaleHintKey; label: string }[] = [
  { key: 'unique_users_per_month', label: 'Unique users per month' },
  { key: 'unique_containers', label: 'Unique containers' },
  { key: 'unique_endpoints', label: 'Unique endpoints' },
];

function FieldGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <fieldset>
        <legend className="text-sm font-medium text-fg">{title}</legend>
        {description && <p className="mt-1 text-xs leading-relaxed text-faint">{description}</p>}
        <div className="mt-4 space-y-5">{children}</div>
      </fieldset>
    </div>
  );
}

interface SliderProps {
  id: string;
  label: string;
  hint?: string;
  /** Color dot tying the control to its chart series. */
  accent?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

function Slider({ id, label, hint, accent, min, max, step, value, format, onChange }: SliderProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="flex items-center gap-2 text-sm text-muted">
          {accent && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: accent }} />}
          {label}
        </label>
        <output htmlFor={id} className="tabular font-mono text-sm text-fg">
          {format(value)}
        </output>
      </div>
      {hint && (
        <p id={hintId} className="mt-0.5 text-xs leading-relaxed text-faint">
          {hint}
        </p>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        aria-describedby={hintId}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full cursor-pointer"
      />
    </div>
  );
}

interface ChipGroupProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function ChipGroup({ label, options, selected, onChange }: ChipGroupProps) {
  // Newly selected chips are appended, so selection order is preserved.
  const toggle = (option: string) =>
    onChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option]);

  return (
    <fieldset>
      <legend className="text-sm text-muted">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option)}
              className={`rounded border px-2 py-1 font-mono text-xs transition-colors ${
                active
                  ? 'border-zinc-300 bg-zinc-200 text-canvas hover:bg-zinc-100'
                  : 'border-line text-muted hover:border-faint hover:text-fg'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface TelemetryProfileFormProps {
  profile: TelemetryProfile;
  onChange: (profile: TelemetryProfile) => void;
}

export function TelemetryProfileForm({ profile, onChange }: TelemetryProfileFormProps) {
  const set = <K extends keyof TelemetryProfile>(key: K, value: TelemetryProfile[K]) =>
    onChange({ ...profile, [key]: value });

  const ratios = cardinalityScopeRatios(profile);
  const hasHighCardinalityTags = profile.high_cardinality_tags.length > 0;

  const setScaleHint = (key: ScaleHintKey, raw: string) => {
    const parsed = Math.floor(Number(raw));
    set(key, raw === '' || !Number.isFinite(parsed) || parsed < 0 ? undefined : parsed);
  };

  return (
    <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
      <FieldGroup title="Logs">
        <Slider
          id="log-volume"
          label="Daily log volume"
          min={0}
          max={1000}
          step={1}
          value={profile.daily_log_volume_gb}
          format={(v) => `${formatCount(v)} GB/day`}
          onChange={(v) => set('daily_log_volume_gb', v)}
        />
        <Slider
          id="log-retention"
          label="Log retention"
          min={1}
          max={90}
          step={1}
          value={profile.log_retention_days}
          format={(v) => `${v} days`}
          onChange={(v) => set('log_retention_days', v)}
        />
      </FieldGroup>

      <FieldGroup title="Traces">
        <Slider
          id="span-count"
          label="Daily span count"
          min={0}
          max={100_000_000}
          step={100_000}
          value={profile.daily_span_count}
          format={(v) => `${formatCompact(v)}/day`}
          onChange={(v) => set('daily_span_count', v)}
        />
        <Slider
          id="sampling-rate"
          label="Trace sampling rate"
          min={0.01}
          max={1}
          step={0.01}
          value={profile.trace_sampling_rate}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => set('trace_sampling_rate', v)}
        />
        <Slider
          id="trace-retention"
          label="Trace retention"
          min={1}
          max={30}
          step={1}
          value={profile.trace_retention_days}
          format={(v) => `${v} days`}
          onChange={(v) => set('trace_retention_days', v)}
        />
      </FieldGroup>

      <FieldGroup title="Metrics">
        <Slider
          id="metric-datapoints"
          label="Daily metric datapoints"
          hint="Not used in pricing yet: Datadog bills custom metrics by series count, not datapoints."
          min={0}
          max={100_000_000}
          step={100_000}
          value={profile.daily_metric_datapoints}
          format={(v) => `${formatCompact(v)}/day`}
          onChange={(v) => set('daily_metric_datapoints', v)}
        />
        <ChipGroup
          label="Low-cardinality dimensions"
          options={LOW_CARDINALITY_DIMENSIONS}
          selected={profile.metric_cardinality_dimensions}
          onChange={(v) => set('metric_cardinality_dimensions', v)}
        />
        <ChipGroup
          label="High-cardinality tags"
          options={HIGH_CARDINALITY_TAGS}
          selected={profile.high_cardinality_tags}
          onChange={(v) => set('high_cardinality_tags', v)}
        />
      </FieldGroup>

      {hasHighCardinalityTags && (
        <FieldGroup
          title="Scale hints"
          description={`Unique values per tag. Tags without a matching hint assume ${formatCount(DEFAULT_HIGH_CARDINALITY_VALUES)}.`}
        >
          <div className="space-y-3">
            {SCALE_HINTS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <label htmlFor={key} className="text-sm text-muted">
                  {label}
                </label>
                <input
                  id={key}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  placeholder={formatCount(DEFAULT_HIGH_CARDINALITY_VALUES)}
                  value={profile[key] ?? ''}
                  onChange={(event) => setScaleHint(key, event.target.value)}
                  className="tabular w-32 rounded border border-line bg-canvas px-2 py-1 text-right font-mono text-sm text-fg transition-colors placeholder:text-faint hover:border-faint focus:border-muted"
                />
              </div>
            ))}
          </div>
        </FieldGroup>
      )}

      {hasHighCardinalityTags && (
        <FieldGroup
          title="Cardinality discipline"
          description="Share of metrics that carry the high-cardinality tags in each scenario."
        >
          {SCENARIOS.map((scenario) => (
            <Slider
              key={scenario.key}
              id={`cardinality-scope-${scenario.key}`}
              label={scenario.label}
              hint={scenario.description}
              accent={scenario.color}
              min={0}
              max={1}
              step={0.01}
              value={ratios[scenario.key]}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => set(SCOPE_FIELDS[scenario.key], v)}
            />
          ))}
        </FieldGroup>
      )}
    </form>
  );
}

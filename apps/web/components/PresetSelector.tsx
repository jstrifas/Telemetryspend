import { PRESETS, type PresetId } from '@/lib/presets';

interface PresetSelectorProps {
  /** The preset the profile still matches; null once the user edits anything. */
  activeId: PresetId | null;
  onSelect: (id: PresetId) => void;
}

export function PresetSelector({ activeId, onSelect }: PresetSelectorProps) {
  const active = PRESETS.find((preset) => preset.id === activeId);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset) => {
          const selected = preset.id === activeId;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              aria-describedby="preset-summary"
              onClick={() => onSelect(preset.id)}
              className={`rounded-md border px-2 py-2 text-xs transition-colors ${
                selected
                  ? 'border-zinc-300 bg-zinc-200 font-medium text-canvas hover:bg-zinc-100'
                  : 'border-line bg-raised text-muted hover:border-faint hover:text-fg'
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <p id="preset-summary" aria-live="polite" className="mt-2 text-xs leading-relaxed text-faint">
        {active ? active.summary : 'Custom profile. Pick a preset to start over.'}
      </p>
    </div>
  );
}

import type { CardinalityScenario } from '@telemetryspend/cost-engine';

export interface ScenarioMeta {
  key: CardinalityScenario;
  label: string;
  description: string;
  color: string; // Tailwind red-500 / yellow-500 / green-500
  textClass: string;
}

export const SCENARIOS: readonly ScenarioMeta[] = [
  {
    key: 'uncapped',
    label: 'Uncapped',
    description: 'Fraction of metrics that carry the tag in worst case',
    color: '#ef4444',
    textClass: 'text-red-400',
  },
  {
    key: 'scoped',
    label: 'Scoped',
    description: 'Fraction if disciplined',
    color: '#eab308',
    textClass: 'text-yellow-400',
  },
  {
    key: 'bounded',
    label: 'Bounded',
    description: 'Fraction if surgically scoped',
    color: '#22c55e',
    textClass: 'text-green-400',
  },
];

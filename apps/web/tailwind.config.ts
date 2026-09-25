import type { Config } from 'tailwindcss';

// Neutral dark palette. Color is reserved for meaning:
// red = cardinality warnings, green = savings.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0a0a0b',
        surface: '#111113',
        raised: '#18181b',
        line: '#26262a',
        fg: '#ededef',
        // Both clear WCAG AA (4.5:1) on canvas, surface, and raised.
        muted: '#a1a1aa',
        faint: '#80808a',
        savings: '#4ade80',
        danger: '#f87171',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calculator · TelemetrySpend',
};

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}

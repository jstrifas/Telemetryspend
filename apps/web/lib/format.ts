const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const compact =new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export const formatUsd = (value: number) => usd.format(value);
export const formatUsdCompact = (value: number) => usdCompact.format(value);
/** Whole dollars below $1M, compact above ("$4,022", "$12.3M"). */
export const formatUsdShort = (value: number) => (value < 1_000_000 ? usdWhole.format(value) : usdCompact.format(value));
export const formatCompact =(value: number) => compact.format(value);
export const formatCount = (value: number) => value.toLocaleString('en-US');

const path = require('node:path');

const monorepoRoot = path.join(__dirname, '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The cost engine ships as TypeScript source; Next compiles it with the app.
  transpilePackages: ['@telemetryspend/cost-engine'],
  turbopack: { root: monorepoRoot },
  outputFileTracingRoot: monorepoRoot,
  // Dev-only badge; it covers the calculator's live totals bar or the nav.
  devIndicators: false,
  // Dev server only: lets the app hydrate when opened via this machine's LAN
  // address instead of localhost. Update if the address changes.
  allowedDevOrigins: ['192.168.1.177'],
};

module.exports = nextConfig;

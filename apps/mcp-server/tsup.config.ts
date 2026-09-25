import { defineConfig } from 'tsup';

// The cost engine ships as TypeScript source, so it is bundled into the
// output. Runtime dependencies (SDK, zod) stay external and resolve from
// node_modules.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node20',
  clean: true,
  noExternal: ['@telemetryspend/cost-engine'],
  banner: { js: '#!/usr/bin/env node' },
});

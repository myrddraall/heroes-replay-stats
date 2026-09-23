import { defineConfig } from 'tsup';

// Two CommonJS bundles: Electron's main process and the preload script. The Angular
// app is not built here — `pnpm --filter @myrddraall/heroes-replay-stats build` puts it in
// packages/app/dist, and the packaging step copies it to ./app.
export default defineConfig({
  entry: { main: 'src/main.ts', preload: 'src/preload.ts' },
  format: ['cjs'],
  outDir: 'out',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  external: ['electron'],
});

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: {
    'worker': 'src/worker.ts',
    'plugin-manifest': 'src/manifest.ts',
  },
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  sourcemap: true,
  external: ['@paperclipai/plugin-sdk', '@paperclipai/plugin-sdk/*'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

console.log('Build complete.');

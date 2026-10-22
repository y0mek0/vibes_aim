import { build } from 'esbuild';

await build({
  entryPoints: ['client/privy/index.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  minify: true,
  outfile: 'client/js/privy-wallet.bundle.js',
});

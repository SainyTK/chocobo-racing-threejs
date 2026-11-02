import { defineConfig } from 'vite';

/** Where the page finds the signaling Worker: production for builds, the local Wrangler for development. */
const PRODUCTION_SIGNAL_URL = 'https://cbr-signal.sainytk.com';
const DEVELOPMENT_SIGNAL_URL = 'http://localhost:8787';

export default defineConfig(({ command }) => ({
  define: { 'import.meta.env.VITE_SIGNAL_URL': JSON.stringify(process.env.VITE_SIGNAL_URL || (command === 'build' ? PRODUCTION_SIGNAL_URL : DEVELOPMENT_SIGNAL_URL)) },
  server: { watch: { ignored: ['**/output/**', '**/tests/**', '**/docs/**'] } },
  // `npm run tunnel` serves the build through a Cloudflare quick tunnel.
  preview: { allowedHosts: ['.trycloudflare.com'] },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], loaders: ['three/addons/loaders/GLTFLoader.js', 'three/addons/libs/meshopt_decoder.module.js', 'three/addons/utils/SkeletonUtils.js'] } } } },
}));

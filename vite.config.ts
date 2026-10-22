import { defineConfig } from 'vite';
export default defineConfig({
  server: { watch: { ignored: ['**/output/**', '**/tests/**', '**/docs/**'] } },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], loaders: ['three/addons/loaders/GLTFLoader.js', 'three/addons/libs/meshopt_decoder.module.js', 'three/addons/utils/SkeletonUtils.js'], network: ['socket.io-client'] } } } },
});

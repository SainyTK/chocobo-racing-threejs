import { defineConfig } from 'vite';
export default defineConfig({
  server: { watch: { ignored: ['**/output/**', '**/tests/**', '**/docs/**'] } },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], network: ['socket.io-client'] } } } },
});

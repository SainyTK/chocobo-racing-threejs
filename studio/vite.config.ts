import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/** `npm run studio`: the internal element viewer. It is a separate Vite root, so it never ships in the game build. */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: { port: 5180, open: true, fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] }, watch: { ignored: ['**/output/**', '**/tests/**', '**/docs/**'] } },
});

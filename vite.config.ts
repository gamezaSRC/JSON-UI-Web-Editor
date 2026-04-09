import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
  optimizeDeps: {
    // Monaco editor needs its workers bundled
    include: ['monaco-editor'],
  },
  worker: {
    format: 'es',
  },
});

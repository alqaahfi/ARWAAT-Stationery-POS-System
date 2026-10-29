import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// index.html carries the production Content-Security-Policy. The dev server
// needs two more things: React Refresh's inline preamble script, and the
// HMR websocket. Added here for `vite` (serve) only — never in a build.
function devCsp() {
  return {
    name: 'arwaat-dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", "connect-src 'self' http://localhost:5173 ws://localhost:5173");
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react(), devCsp()],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, 'src/renderer/dist'),
    emptyOutDir: true,
  },
});

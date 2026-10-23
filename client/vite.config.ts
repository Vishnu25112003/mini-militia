import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    // the shared package (map JSON, tileset) lives one level up, outside this package's root
    fs: { allow: [root] },
  },
  build: { chunkSizeWarningLimit: 2000 },
});

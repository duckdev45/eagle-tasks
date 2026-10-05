import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `base: './'` keeps the build relocatable — works on GitHub Pages sub-paths
// (https://<org>.github.io/eagle-tasks/) without extra config.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'] },
});

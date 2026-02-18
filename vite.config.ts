import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Set the base path to your repository name for GitHub Pages
  base: '/AdventureForge/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Dependencies should be bundled, not externalized, for a standard deployment
    },
  },
  server: {
    host: true,
    port: 3000,
  }
});

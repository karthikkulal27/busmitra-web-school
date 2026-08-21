import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // So you can open the page from your phone on the same wifi.
    host: true,
    proxy: {
      // The Protomaps demo archive serves no Access-Control-Allow-Origin, so a
      // browser cannot Range-request it from localhost even though curl and
      // Node can. Proxying makes it same-origin for development only.
      //
      // Production does not use this: point VITE_TILES_URL at your own R2
      // bucket and set CORS there (AllowedOrigins + ExposeHeaders for Range).
      '/pmtiles-demo': {
        target: 'https://demo-bucket.protomaps.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pmtiles-demo/, ''),
      },
    },
  },
});

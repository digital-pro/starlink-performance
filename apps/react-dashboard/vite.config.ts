import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/netdata': {
        target: `http://${process.env.NETDATA_HOST || '127.0.0.1'}:19999`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/netdata/, '/api/v1/data')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
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

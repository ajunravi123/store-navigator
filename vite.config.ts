import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Use environment variable for API proxy target, fallback to localhost for development
  // In production, if VITE_API_URL is not set, use localhost since Express runs on same machine
  const apiTarget = env.VITE_API_URL || 'http://localhost:3001';

  return {
    server: {
      port: 5173,
      host: '0.0.0.0',
      allowedHosts: ['ajunsmachine.theworkpc.com'],
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          // Ensure we're connecting to the right host
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.error('Proxy error:', err.message);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Proxying request:', req.method, req.url, 'to', apiTarget);
            });
          },
        },
      },
    },
    preview: {
      port: 5173,
      host: '0.0.0.0',
      allowedHosts: ['ajunsmachine.theworkpc.com'],
      proxy: {
        '/api': {
          // In preview mode, ALWAYS use localhost:3001 since Express runs on same machine
          // Ignore VITE_API_URL in preview to avoid proxy errors
          target: 'http://127.0.0.1:3001',
          changeOrigin: false, // Don't change origin for localhost
          secure: false,
          ws: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, req, res) => {
              console.error('Preview proxy error:', err.message);
              console.error('Failed to proxy:', req.method, req.url, 'to http://127.0.0.1:3001');
              console.error('Make sure Express server is running on port 3001');
              if (!res.headersSent) {
                res.writeHead(500, {
                  'Content-Type': 'application/json',
                });
                res.end(JSON.stringify({
                  error: 'Proxy error: ' + err.message,
                  hint: 'Ensure Express server is running on port 3001'
                }));
              }
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Proxying:', req.method, req.url, '→ http://127.0.0.1:3001');
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Proxy response:', req.method, req.url, '→', proxyRes.statusCode);
            });
          },
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

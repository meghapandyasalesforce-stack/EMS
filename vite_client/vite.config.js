import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Custom plugin to handle proxy errors gracefully and suppress ECONNREFUSED logs
const handleProxyErrors = () => {
  return {
    name: 'handle-proxy-errors',
    configureServer(server) {
      // Suppress Vite's proxy error logging for connection issues
      // Only intercept errors that match proxy connection failures
      const originalWrite = process.stderr.write.bind(process.stderr);
      const suppressedPatterns = [
        /\[vite\] http proxy error.*ECONNREFUSED/,
        /\[vite\] http proxy error.*ECONNRESET/,
        /\[vite\] http proxy error.*ETIMEDOUT/,
        /AggregateError.*ECONNREFUSED/,
        /AggregateError.*ECONNRESET/
      ];
      
      process.stderr.write = function(chunk, encoding, fd) {
        const message = chunk.toString();
        // Only suppress Vite proxy errors, not other important errors
        const isProxyError = suppressedPatterns.some(pattern => pattern.test(message));
        const isApiOrUploads = message.includes('/api/') || message.includes('/uploads');
        
        // Check if this is an SSE endpoint error (get-all-notification)
        const isSSEEndpoint = message.includes('/get-all-notification');
        
        if (isProxyError && isApiOrUploads) {
          // For SSE endpoints, ECONNRESET is normal when clients disconnect - always suppress
          if (isSSEEndpoint && message.includes('ECONNRESET')) {
            return true;
          }
          // Suppress other proxy connection errors - backend is likely not running
          // This is expected during development when backend hasn't started yet
          return true;
        }
        // Write other errors normally (including non-proxy errors)
        return originalWrite(chunk, encoding, fd);
      };
      
      // Clean up on server close
      server.httpServer?.once('close', () => {
        process.stderr.write = originalWrite;
      });
    }
  };
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables using Vite's loadEnv
  // This properly handles VITE_* prefixed variables in config files
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
  // Suppress verbose logging for proxy errors
  logLevel: env.VITE_LOG_LEVEL || 'warn',
  clearScreen: false, // Don't clear screen on errors
  plugins: [
    handleProxyErrors(), // Add this plugin to handle proxy errors gracefully
    react({
      // Ensure production build uses production React
      jsxRuntime: 'automatic',
    }),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo192.png', 'logo512.png'],
      // Use manifest.webmanifest (default) instead of manifest.json
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'Paarsiv - Employee Management System',
        short_name: 'Paarsiv',
        description: 'Employee Management System for tracking attendance, payroll, and more',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon'
          },
          {
            src: 'logo192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'logo512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000, // 5 MB limit
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Fix navigation routing for SPA
        // Use index.html for all navigation requests (SPA routing)
        // Must match the base path - use absolute path for web deployment
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/_/, /\/[^/?]+\.[^/]+$/],
        // Ensure proper caching
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  build: {
    outDir: 'dist',              // ⬅️ build frontend into dist folder
    emptyOutDir: true,           // cleans before build
    // Ensure assets are properly handled for Capacitor
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Optimize chunk splitting for better code splitting
        manualChunks: (id) => {
          // Vendor chunks - split large libraries into separate chunks
          if (id.includes('node_modules')) {
            // React core libraries (keep together as they're tightly coupled)
            if (id.includes('react') && !id.includes('react-dom')) {
              return 'react-core';
            }
            if (id.includes('react-dom')) {
              return 'react-dom';
            }
            if (id.includes('react-redux') || id.includes('use-sync-external-store')) {
              return 'react-redux';
            }
            
            // Redux core
            if (id.includes('@reduxjs/toolkit')) {
              return 'redux-toolkit';
            }
            if (id.includes('redux-persist')) {
              return 'redux-persist';
            }
            
            // Material UI - split into smaller chunks
            if (id.includes('@mui/material')) {
              return 'mui-material';
            }
            if (id.includes('@mui/icons-material')) {
              return 'mui-icons';
            }
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'mui-core';
            }
            
            // Charts libraries (can be large)
            if (id.includes('chart.js')) {
              return 'chartjs';
            }
            if (id.includes('recharts')) {
              return 'recharts';
            }
            if (id.includes('react-chartjs-2')) {
              return 'react-chartjs';
            }
            
            // Router
            if (id.includes('react-router')) {
              return 'react-router';
            }
            
            // Google Maps (large library)
            if (id.includes('@react-google-maps') || id.includes('@vis.gl/react-google-maps')) {
              return 'google-maps';
            }
            
            // Capacitor (mobile-specific, can be large)
            if (id.includes('@capacitor')) {
              return 'capacitor';
            }
            
            // PDF and image processing (large libraries)
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('qrcode')) {
              return 'document-processing';
            }
            
            // Date utilities
            if (id.includes('date-fns')) {
              return 'date-utils';
            }
            
            // Animation libraries
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            
            // HTTP client
            if (id.includes('axios')) {
              return 'axios';
            }
            
            // i18n
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n';
            }
            
            // Toast notifications
            if (id.includes('react-toastify')) {
              return 'toastify';
            }
            
            // Other vendor libraries
            return 'vendor';
          }
          
          // Split by feature areas for better code splitting
          // Admin features
          if (id.includes('/Admin/')) {
            if (id.includes('/Admin/Employee/')) {
              return 'admin-employee';
            }
            if (id.includes('/Admin/project/') || id.includes('/Admin/Project/')) {
              return 'admin-project';
            }
            if (id.includes('/Admin/Payroll/')) {
              return 'admin-payroll';
            }
            if (id.includes('/Admin/')) {
              return 'admin';
            }
          }
          
          // HR features
          if (id.includes('/HR/')) {
            return 'hr';
          }
          
          // Employee features
          if (id.includes('/Employee/')) {
            return 'employee';
          }
          
          // Dashboard features
          if (id.includes('/Dashboard') || id.includes('/dashboard')) {
            return 'dashboard';
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Disable source maps in production for security and performance
    sourcemap: false,
    // Increase chunk size warning limit slightly (chunks under 1500KB are acceptable)
    // The improved manualChunks should keep most chunks under 1000KB
    chunkSizeWarningLimit: 1500,
  },
  // Set base path - use '/' for web deployment (Vercel)
  // IMPORTANT: Vercel requires '/' for proper asset and routing resolution
  // For Capacitor builds, override this in the build script or use environment variable
  // Default to '/' for web, can be overridden with VITE_BASE_PATH env var
  // Note: Using loadEnv ensures VITE_* prefixed variables are correctly loaded
  base: env.VITE_BASE_PATH || '/',
  optimizeDeps: {
    exclude: [
      'html2canvas',
      'qrcode',
      'bootstrap-icons'
    ],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      '@reduxjs/toolkit',
      'react-redux',
      'redux-persist'
    ]
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:10000', // Backend default port is 10000 (or PORT env var)
        changeOrigin: true,
        secure: false,
        // Handle connection errors gracefully - suppress ECONNREFUSED errors
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Check if this is an SSE endpoint (Server-Sent Events)
            const isSSEEndpoint = req.url?.includes('/get-all-notification');
            
            // SSE endpoints need long-lived connections - don't apply timeout
            if (!isSSEEndpoint) {
              // Set timeout to prevent hanging requests (only for non-SSE endpoints)
              proxyReq.setTimeout(5000, () => {
                if (!res.headersSent) {
                  res.writeHead(503, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ 
                    success: false, 
                    message: 'Service unavailable',
                    code: 'SERVICE_UNAVAILABLE'
                  }));
                }
              });
            } else {
              // For SSE endpoints, set a very long timeout (1 hour) to allow long-lived connections
              proxyReq.setTimeout(3600000); // 1 hour timeout for SSE connections
            }
          });
          
          proxy.on('error', (err, req, res) => {
            // Check if this is an SSE endpoint
            const isSSEEndpoint = req.url?.includes('/get-all-notification');
            
            // For SSE endpoints, ECONNRESET is normal when clients disconnect
            // Suppress these errors completely
            if (isSSEEndpoint && (err.code === 'ECONNRESET' || err.message?.includes('aborted'))) {
              // SSE connection reset is normal - silently ignore
              return;
            }
            
            // Silently handle connection refused errors (backend not running)
            if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
              // Suppress error logging and send a 503 response
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  success: false, 
                  message: 'Service unavailable',
                  code: 'SERVICE_UNAVAILABLE'
                }));
              }
              // Prevent error from being logged by returning early
              return;
            }
            // For other errors, let them propagate (they'll be logged by Vite)
            console.error('Proxy error:', err.message);
          });
        },
        // Suppress error logging at the proxy level
        ws: false,
        timeout: 300000, // 5 minutes timeout (SSE endpoints handled per-request above)
      },
      '/uploads': {
        target: 'http://localhost:10000', // Backend default port is 10000 (or PORT env var)
        changeOrigin: true,
        secure: false,
        // Handle connection errors gracefully - suppress ECONNREFUSED errors
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Set timeout to prevent hanging requests
            proxyReq.setTimeout(5000, () => {
              if (!res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  success: false, 
                  message: 'Service unavailable',
                  code: 'SERVICE_UNAVAILABLE'
                }));
              }
            });
          });
          
          proxy.on('error', (err, req, res) => {
            // Silently handle connection refused errors (backend not running)
            if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
              // Suppress error logging and send a 503 response
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                  success: false, 
                  message: 'Service unavailable',
                  code: 'SERVICE_UNAVAILABLE'
                }));
              }
              // Prevent error from being logged by returning early
              return;
            }
            // For other errors, let them propagate (they'll be logged by Vite)
            console.error('Proxy error:', err.message);
          });
        },
        // Suppress error logging at the proxy level
        ws: false,
        timeout: 5000,
      },
    },
    // Suppress connection errors in the server log
    hmr: {
      overlay: false, // Disable error overlay for connection issues
    },
  },
  };
});
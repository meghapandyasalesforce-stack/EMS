import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
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
          // Vendor chunks
          if (id.includes('node_modules')) {
            // React, React DOM, and React-Redux (they're tightly coupled)
            // react-redux directly depends on React's internals, so it must be with React
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-redux')) {
              return 'react-vendor';
            }
            // Redux core (without react-redux)
            if (id.includes('@reduxjs/toolkit') || id.includes('redux-persist')) {
              return 'redux-vendor';
            }
            // Material UI
            if (id.includes('@mui')) {
              return 'mui-vendor';
            }
            // Charts
            if (id.includes('chart.js') || id.includes('recharts') || id.includes('react-chartjs-2')) {
              return 'charts-vendor';
            }
            // Other large libraries
            if (id.includes('axios') || id.includes('date-fns')) {
              return 'utils-vendor';
            }
            // Everything else from node_modules
            return 'vendor';
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
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
  },
  // Set base path - use '/' for web deployment (Vercel)
  // IMPORTANT: Vercel requires '/' for proper asset and routing resolution
  // For Capacitor builds, override this in the build script or use environment variable
  // Default to '/' for web, can be overridden with VITE_BASE_PATH env var
  // Note: Use process.env in vite.config.js, not import.meta.env
  base: process.env.VITE_BASE_PATH || '/',
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
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
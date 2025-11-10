import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo192.png', 'logo512.png'],
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
            // React and React DOM
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Redux
            if (id.includes('@reduxjs/toolkit') || id.includes('react-redux') || id.includes('redux-persist')) {
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
    // Enable source maps in development
    sourcemap: process.env.NODE_ENV === 'development',
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
  },
  // Set base path for Capacitor
  base: './',
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
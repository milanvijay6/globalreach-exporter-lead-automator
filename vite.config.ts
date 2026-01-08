import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: './',
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1 hour
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: process.env.BUILD_OUT_DIR || path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // Always enable source maps for better error debugging
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
    target: 'es2015',
    chunkSizeWarningLimit: 100, // Warn if chunk exceeds 100KB
    rollupOptions: {
      external: [
        'imap',
        'nodemailer',
        'googleapis',
        'mailparser',
        'express',
        'winston',
        'electron',
        'electron-updater',
        'fs',
        'path',
        'crypto',
        'net',
        'tls',
        'http',
        'https',
        'stream',
        'util',
        'events',
        'os',
        'dns',
        'querystring',
        'zlib',
        'child_process',
        'http2',
        'assert',
        'process',
        'buffer',
        'url'
      ],
      output: {
        manualChunks: (id) => {
          // React core - separate chunk
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // Charts - lazy loaded, separate chunk
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
          }
          // UI libraries - separate chunk
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // Virtual scrolling library
          if (id.includes('node_modules/@tanstack/react-virtual')) {
            return 'vendor-virtual';
          }
          // State management
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }
          // Parse SDK - separate chunk
          if (id.includes('node_modules/parse')) {
            return 'vendor-parse';
          }
          // XLSX chunk
          if (id.includes('node_modules/xlsx')) {
            return 'vendor-xlsx';
          }
          // QRCode chunk
          if (id.includes('node_modules/qrcode')) {
            return 'vendor-qrcode';
          }
          // Gemini/Google AI chunk
          if (id.includes('node_modules/@google/genai')) {
            return 'vendor-gemini';
          }
          // Business logic - feature-based chunks
          if (id.includes('/components/')) {
            // Extract feature name from path
            const featureMatch = id.match(/components\/([^/]+)/);
            if (featureMatch) {
              const feature = featureMatch[1];
              // Group related components
              if (['ImporterList', 'LeadImportWizard'].includes(feature)) {
                return 'feature-leads';
              }
              if (['ChatInterface', 'Message'].includes(feature)) {
                return 'feature-chat';
              }
              if (['AnalyticsDashboard'].includes(feature)) {
                return 'feature-analytics';
              }
              if (['CampaignManager'].includes(feature)) {
                return 'feature-campaigns';
              }
              if (['SettingsModal'].includes(feature)) {
                return 'feature-settings';
              }
              if (['OwnerAdminPanel', 'AdminMonitoringDashboard'].includes(feature)) {
                return 'feature-admin';
              }
            }
            return 'components';
          }
          // Services - separate chunk
          if (id.includes('/services/')) {
            return 'services';
          }
          // Other node_modules go into vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        // Optimize chunk file names
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    cors: true,
    strictPort: false
  },
  optimizeDeps: {
    exclude: ['imap', 'nodemailer', 'googleapis', 'mailparser', 'express', 'winston'],
    // Exclude emailService from pre-bundling to prevent nodemailer resolution
    esbuildOptions: {
      plugins: []
    }
  },
  ssr: {
    external: ['nodemailer', 'imap', 'googleapis', 'mailparser', 'express', 'winston']
  },
  define: {
    // Prevent bundling of Node.js modules
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});
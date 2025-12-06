import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: process.env.BUILD_OUT_DIR || path.resolve(__dirname, 'build'),
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
          // Vendor chunk for React and React-DOM
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // Charts chunk for recharts
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
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
          // Lucide icons chunk (can be large)
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
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
    noExternal: false, // Don't bundle Node.js modules for SSR
    external: ['nodemailer', 'imap', 'googleapis', 'mailparser', 'express', 'winston']
  },
  define: {
    // Prevent bundling of Node.js modules
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: process.env.BUILD_BASE || './',
  plugins: [react()],
  build: {
    outDir: process.env.BUILD_OUT_DIR || path.resolve(__dirname, 'electron/build'),
    emptyOutDir: true,
    // Always enable source maps for better error debugging
    sourcemap: true,
    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
    target: 'es2015',
    chunkSizeWarningLimit: 1000,
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
      ]
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
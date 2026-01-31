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
    sourcemap: process.env.NODE_ENV !== 'production',
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
    esbuildOptions: {
      plugins: []
    }
  },
  ssr: {
    noExternal: false,
    external: ['nodemailer', 'imap', 'googleapis', 'mailparser', 'express', 'winston']
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});


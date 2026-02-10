#!/usr/bin/env node

// Pre-build check script for Azure/CI compatibility
// Skips the Vite frontend build if:
// 1. build/index.html already exists (pre-built in CI)
// 2. index.html source doesn't exist (server-only deployment)

const fs = require('fs');
const path = require('path');

const buildIndex = path.join(__dirname, '..', 'build', 'index.html');
const sourceIndex = path.join(__dirname, '..', 'index.html');

if (fs.existsSync(buildIndex)) {
  console.log('[build-check] build/index.html already exists. Skipping frontend build.');
  process.exit(1); // Non-zero exit causes the && chain to skip vite build
}

if (!fs.existsSync(sourceIndex)) {
  console.log('[build-check] index.html source not found. Skipping frontend build (server-only deployment).');
  process.exit(1); // Non-zero exit causes the && chain to skip vite build
}

// Source exists and no build yet - proceed with build
console.log('[build-check] Source files found, no existing build. Proceeding with Vite build...');
process.exit(0);

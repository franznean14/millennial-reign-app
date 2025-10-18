#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting HTTPS development server...\n');

// Start Next.js dev server on port 3000
const nextDev = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3000' }
});

// Wait a moment for Next.js to start
setTimeout(() => {
  console.log('\n🔒 Starting HTTPS proxy on port 3001...\n');
  
  // Start HTTPS proxy
  const httpsProxy = spawn('npx', ['local-ssl-proxy', '--source', '3001', '--target', '3000'], {
    stdio: 'inherit',
    shell: true
  });

  console.log('✅ HTTPS development server ready!');
  console.log('📱 Local HTTPS URL: https://localhost:3001');
  console.log('🔧 HTTP fallback: http://localhost:3000');
  console.log('\n📋 For push notifications testing:');
  console.log('   1. Visit https://localhost:3001 on your iPhone');
  console.log('   2. Accept the security warning (self-signed certificate)');
  console.log('   3. Install as PWA (Add to Home Screen)');
  console.log('   4. Open the PWA and test notifications\n');

  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down servers...');
    nextDev.kill();
    httpsProxy.kill();
    process.exit(0);
  });

}, 3000);

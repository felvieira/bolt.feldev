#!/usr/bin/env node
import pkg from '@remix-run/dev';

async function runBuild() {
  try {
    process.env.NODE_NO_WARNINGS = '1';
    console.log('🚀 Imported package:', pkg);
    console.log('Package keys:', Object.keys(pkg));
    
    // Try to find the build function
    const buildFunction = pkg.build || pkg.default?.build;
    
    if (typeof buildFunction !== 'function') {
      console.error('❌ Build function not found. Available exports:', Object.keys(pkg));
      process.exit(1);
    }

    console.log('🔨 Starting Remix build...');
    await buildFunction();
    
    console.log('✅ Remix build completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Remix build failed:', error);
    process.exit(1);
  }
}

runBuild();

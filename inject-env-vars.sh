#!/bin/bash
set -e

SERVER_INDEX="./build/server/index.js"

if [ -f "$SERVER_INDEX" ]; then
  echo "Injecting environment variables into server build"
  
  # Check if the file already has our bridge code to avoid duplicates
  if ! grep -q "if(typeof globalThis!==\"undefined\"){if(typeof process===\"undefined\")" "$SERVER_INDEX"; then
    # Add environment variable setup to beginning of file, but after any existing code
    # This ensures we don't overwrite any hardcoded credentials that might be at the top
    sed -i '1,10 s/^/if(typeof globalThis!==\"undefined\"){if(typeof process===\"undefined\")globalThis.process={env:{}};else if(!process.env)process.env={};if(typeof globalThis.env!==\"undefined\"){Object.keys(globalThis.env).forEach(key=>{process.env[key]=globalThis.env[key];});}}\\n/' "$SERVER_INDEX"
    
    echo "Successfully injected environment bridge into $SERVER_INDEX"
  else
    echo "Environment bridge already exists in $SERVER_INDEX, skipping injection"
  fi
else
  echo "Warning: $SERVER_INDEX not found"
fi

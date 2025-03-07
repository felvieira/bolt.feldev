#!/bin/bash
set -e

SERVER_INDEX="./build/server/index.js"

if [ -f "$SERVER_INDEX" ]; then
  echo "Injecting environment variables into server build"
  
  # Add environment variable setup to beginning of file
  sed -i "1s/^/if(typeof globalThis!==\"undefined\"){if(typeof process===\"undefined\")globalThis.process={env:{}};else if(!process.env)process.env={};if(typeof globalThis.env!==\"undefined\"){Object.keys(globalThis.env).forEach(key=>{process.env[key]=globalThis.env[key];});}}\\n/" "$SERVER_INDEX"
  
  echo "Successfully injected environment bridge into $SERVER_INDEX"
else
  echo "Warning: $SERVER_INDEX not found"
fi

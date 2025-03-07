#!/bin/bash
set -e

# Get the Supabase credentials from the environment
SUPABASE_URL="${SUPABASE_URL}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}"

# Ensure they're provided
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "ERROR: Supabase credentials not provided. Please set SUPABASE_URL and SUPABASE_ANON_KEY."
  exit 1
fi

# Find the supabase.server.ts file in the build
echo "Directly patching supabase client in built JavaScript..."

# Get list of files in build directory
SERVER_DIR="./build/server"
CLIENT_DIR="./build/client"

# Directly inject Supabase credentials into all JavaScript files
find "$SERVER_DIR" -name "*.js" -exec sed -i "s|import{createClient}from'@supabase/supabase-js'|import{createClient}from'@supabase/supabase-js';const HARDCODED_URL='$SUPABASE_URL';const HARDCODED_KEY='$SUPABASE_ANON_KEY'|g" {} \;
find "$SERVER_DIR" -name "*.js" -exec sed -i "s|const supabaseUrl=process.env.SUPABASE_URL|const supabaseUrl=HARDCODED_URL||process.env.SUPABASE_URL|g" {} \;
find "$SERVER_DIR" -name "*.js" -exec sed -i "s|const supabaseAnonKey=process.env.SUPABASE_ANON_KEY|const supabaseAnonKey=HARDCODED_KEY||process.env.SUPABASE_ANON_KEY|g" {} \;

echo "Supabase credentials have been directly injected into the built JavaScript."

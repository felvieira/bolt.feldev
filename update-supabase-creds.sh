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

# Get list of files in build directory
SERVER_DIR="./build/server"
CLIENT_DIR="./build/client"

echo "Injecting Supabase credentials directly into JavaScript files..."

# Create a JavaScript file with the hardcoded credentials
cat > "$SERVER_DIR/supabase-credentials.js" << EOF
// Hardcoded Supabase credentials (injected by update-supabase-creds.sh)
export const SUPABASE_URL = "$SUPABASE_URL";
export const SUPABASE_ANON_KEY = "$SUPABASE_ANON_KEY";
export const SUPABASE_SERVICE_KEY = "$SUPABASE_SERVICE_KEY";
EOF

# Create a script tag to include in HTML
cat > "$CLIENT_DIR/supabase-credentials.js" << EOF
// Hardcoded Supabase credentials for browser
window.SUPABASE_URL = "$SUPABASE_URL";
window.SUPABASE_ANON_KEY = "$SUPABASE_ANON_KEY";
console.log("Supabase credentials injected in window object");
EOF

# Add a script tag to include credentials in HTML
find "$CLIENT_DIR" -name "*.html" -exec sed -i '/<head>/a <script src="/supabase-credentials.js"></script>' {} \;

# Create a patched version of server/index.js with hardcoded credentials at the top
if [ -f "$SERVER_DIR/index.js" ]; then
  echo "Patching server/index.js with hardcoded credentials..."
  
  # Create a temporary file with hardcoded credentials at the top
  cat > "$SERVER_DIR/temp-index.js" << EOF
// Hardcoded Supabase credentials (injected by update-supabase-creds.sh)
globalThis.HARDCODED_URL = "$SUPABASE_URL";
globalThis.HARDCODED_KEY = "$SUPABASE_ANON_KEY";
globalThis.SUPABASE_URL = "$SUPABASE_URL";
globalThis.SUPABASE_ANON_KEY = "$SUPABASE_ANON_KEY";
// Add to process.env as well
if (typeof process === 'undefined') globalThis.process = { env: {} };
else if (!process.env) process.env = {};
process.env.SUPABASE_URL = "$SUPABASE_URL";
process.env.SUPABASE_ANON_KEY = "$SUPABASE_ANON_KEY";
process.env.SUPABASE_SERVICE_KEY = "$SUPABASE_SERVICE_KEY";

EOF
  
  # Append the original index.js content
  cat "$SERVER_DIR/index.js" >> "$SERVER_DIR/temp-index.js"
  
  # Replace the original file
  mv "$SERVER_DIR/temp-index.js" "$SERVER_DIR/index.js"
  
  echo "Successfully patched $SERVER_DIR/index.js"
else
  echo "Warning: $SERVER_DIR/index.js not found"
fi

echo "Supabase credentials have been directly injected into the built JavaScript."

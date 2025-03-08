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

# Create a JavaScript file with the hardcoded credentials for client-side
cat > "$CLIENT_DIR/supabase-credentials.js" << EOF
// Hardcoded Supabase credentials for browser
window.SUPABASE_URL = "$SUPABASE_URL";
window.SUPABASE_ANON_KEY = "$SUPABASE_ANON_KEY";
console.log("Supabase credentials injected in window object");
EOF

# Add script to HTML files
for HTML_FILE in $(find "$CLIENT_DIR" -name "*.html"); do
  echo "Adding credential script to $HTML_FILE"
  if grep -q "<head>" "$HTML_FILE"; then
    sed -i '/<head>/a <script src="/supabase-credentials.js"></script>' "$HTML_FILE"
  else
    sed -i '/<html/a <script src="/supabase-credentials.js"></script>' "$HTML_FILE"
  fi
done

# Patch server/index.js
if [ -f "$SERVER_DIR/index.js" ]; then
  echo "Patching server/index.js with hardcoded credentials..."
  
  # Create a temporary file with hardcoded credentials at the top
  TMP_FILE=$(mktemp)
  cat > "$TMP_FILE" << EOF
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
  cat "$SERVER_DIR/index.js" >> "$TMP_FILE"
  
  # Replace the original file
  mv "$TMP_FILE" "$SERVER_DIR/index.js"
  
  echo "Successfully patched $SERVER_DIR/index.js"
fi

# Replace hardcoded values in all JS files
echo "Replacing hardcoded placeholder values in all JS files..."
find "$SERVER_DIR" -name "*.js" -exec sed -i "s|https://replace-with-actual-supabase-url.supabase.co|$SUPABASE_URL|g" {} \;
find "$SERVER_DIR" -name "*.js" -exec sed -i "s|replace-with-actual-supabase-key|$SUPABASE_ANON_KEY|g" {} \;

echo "Supabase credentials have been directly injected into the built JavaScript."

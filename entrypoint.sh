#!/bin/bash
set -e
echo "Starting entrypoint script for bolt.diy"

# Check if necessary env variables are present
echo "DEBUG: Environment variables in container:"
echo "SUPABASE_URL present: ${SUPABASE_URL:+yes}"
echo "SUPABASE_ANON_KEY present: ${SUPABASE_ANON_KEY:+yes}"
echo "SUPABASE_SERVICE_KEY present: ${SUPABASE_SERVICE_KEY:+yes}"
echo "SESSION_SECRET present: ${SESSION_SECRET:+yes}"

# Check for and use persisted session secret
PERSISTED_SECRET_PATH="/app/session-data/session-secret"
if [ -z "${SESSION_SECRET}" ] && [ -f "${PERSISTED_SECRET_PATH}" ]; then
  echo "Found persisted SESSION_SECRET, using it instead of environment variable"
  export SESSION_SECRET=$(cat "${PERSISTED_SECRET_PATH}")
fi

# Check if SESSION_SECRET is set
if [ -z "${SESSION_SECRET}" ]; then
  echo "WARNING: SESSION_SECRET environment variable is not set!"
  
  # Run setup script if available to generate SESSION_SECRET
  if [ -f "./coolify-setup.sh" ]; then
    echo "Running coolify-setup.sh to generate SESSION_SECRET"
    chmod +x ./coolify-setup.sh
    ./coolify-setup.sh
  else
    # Generate a temporary SESSION_SECRET
    export SESSION_SECRET=$(openssl rand -base64 32)
    echo "Generated temporary SESSION_SECRET (value hidden for security)"
  fi
else
  echo "SESSION_SECRET is set (value hidden for security)"
fi

# Validate critical environment variables
if [ -z "${SUPABASE_URL}" ]; then
  echo "ERROR: SUPABASE_URL is not set. This is required for production."
  exit 1
fi

if [ -z "${SUPABASE_ANON_KEY}" ]; then
  echo "ERROR: SUPABASE_ANON_KEY is not set. This is required for production."
  exit 1
fi

# Run the direct Supabase credentials injection script
if [ -f "./update-supabase-creds.sh" ]; then
  echo "Running direct Supabase credentials injection script..."
  chmod +x ./update-supabase-creds.sh
  ./update-supabase-creds.sh
else
  echo "WARNING: update-supabase-creds.sh not found. Supabase credentials will not be directly injected."
fi

# Create .env.local with all environment variables
echo "Creating .env.local with current environment variables"
echo "SESSION_SECRET=${SESSION_SECRET}" > .env.local
echo "SUPABASE_URL=${SUPABASE_URL}" >> .env.local
echo "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" >> .env.local
echo "SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}" >> .env.local
echo "DATABASE_URL=${DATABASE_URL}" >> .env.local

# Create .dev.vars with all environment variables for Wrangler
echo "Creating .dev.vars with current environment variables"
echo "SESSION_SECRET=${SESSION_SECRET}" > .dev.vars
echo "SUPABASE_URL=${SUPABASE_URL}" >> .dev.vars
echo "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" >> .dev.vars
echo "SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}" >> .dev.vars
echo "DATABASE_URL=${DATABASE_URL}" >> .dev.vars

# Create a .env file that will be read by Node.js and Wrangler
echo "Creating .env file with current environment variables"
echo "SESSION_SECRET=${SESSION_SECRET}" > .env
echo "SUPABASE_URL=${SUPABASE_URL}" >> .env
echo "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" >> .env
echo "SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}" >> .env
echo "DATABASE_URL=${DATABASE_URL}" >> .env

# Create a JS file to ensure environment variables are accessible in the browser context
echo "Creating injected-env.js to ensure environment variables are available"
cat > ./build/client/injected-env.js << EOF
// Environment variables injected by entrypoint.sh
// This ensures they're available in the browser context
globalThis.__ENV__ = {
  SUPABASE_URL: "${SUPABASE_URL}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY}"
};
console.log("Injected environment variables via injected-env.js");
EOF

# Run the environment variable injection script again at runtime
if [ -f "/inject-env-vars.sh" ]; then
  echo "Running environment variable injection script at runtime"
  ./inject-env-vars.sh
else
  echo "WARNING: inject-env-vars.sh not found, skipping runtime injection"
fi

echo "Configuration complete. Starting application..."

# Prepare explicit bindings for Wrangler with quotes to handle special characters
DIRECT_BINDINGS="--binding SESSION_SECRET='${SESSION_SECRET}' --binding SUPABASE_URL='${SUPABASE_URL}' --binding SUPABASE_ANON_KEY='${SUPABASE_ANON_KEY}' --binding SUPABASE_SERVICE_KEY='${SUPABASE_SERVICE_KEY}'"

# If bindings.sh exists, use it to generate bindings for Wrangler
if [ -f "./bindings.sh" ]; then
  echo "Generating bindings using bindings.sh"
  chmod +x ./bindings.sh
  BINDINGS=$(./bindings.sh)
  echo "Generated bindings from bindings.sh"
  
  # Check if bindings already contain Supabase variables
  if [[ "$BINDINGS" != *"--binding SUPABASE_URL"* ]]; then
    echo "Adding Supabase bindings to bindings.sh output"
    BINDINGS="$BINDINGS $DIRECT_BINDINGS"
  else
    echo "Using bindings from bindings.sh (already includes Supabase bindings)"
  fi
  
  # Start with bindings from bindings.sh and directly set env vars
  echo "Starting application with combined bindings"
  exec env SUPABASE_URL="${SUPABASE_URL}" SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}" SESSION_SECRET="${SESSION_SECRET}" \
       wrangler pages dev ./build/client ${BINDINGS} --ip 0.0.0.0 --port 5173 --no-show-interactive-dev-session
else
  # Start with direct bindings
  echo "Starting with direct bindings"
  exec env SUPABASE_URL="${SUPABASE_URL}" SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}" SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}" SESSION_SECRET="${SESSION_SECRET}" \
       wrangler pages dev ./build/client ${DIRECT_BINDINGS} --ip 0.0.0.0 --port 5173 --no-show-interactive-dev-session
fi

#!/bin/bash
set -e

echo "Starting entrypoint script for bolt.diy"

# Add this near the beginning of entrypoint.sh
echo "DEBUG: Environment variables in container:"
echo "SUPABASE_URL present: ${SUPABASE_URL:+yes}"
echo "SUPABASE_ANON_KEY present: ${SUPABASE_ANON_KEY:+yes}"

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

# Ensure .env.local and .dev.vars are created with current SESSION_SECRET
echo "Ensuring configuration files have current SESSION_SECRET"
echo "SESSION_SECRET=${SESSION_SECRET}" > .env.local
echo "SESSION_SECRET=${SESSION_SECRET}" > .dev.vars

echo "Configuration complete. Starting application..."

# If bindings.sh exists, use it to generate bindings for Wrangler
if [ -f "./bindings.sh" ]; then
  echo "Generating bindings using bindings.sh"
  chmod +x ./bindings.sh
  BINDINGS=$(./bindings.sh)
  echo "Generated bindings: ${BINDINGS}"
fi

# Start the application with the appropriate bindings
echo "Starting application with wrangler"
if [ -n "${BINDINGS}" ]; then
  echo "Using bindings from bindings.sh"
  exec wrangler pages dev ./build/client ${BINDINGS} --ip 0.0.0.0 --port 5173 --no-show-interactive-dev-session
else
  echo "Starting without explicit bindings"
  exec wrangler pages dev ./build/client --binding SESSION_SECRET=${SESSION_SECRET} --ip 0.0.0.0 --port 5173 --no-show-interactive-dev-session
fi
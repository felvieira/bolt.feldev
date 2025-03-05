#!/bin/bash
set -e

echo "Starting entrypoint script for bolt.diy"

# Check if SESSION_SECRET is set
if [ -z "${SESSION_SECRET}" ]; then
  echo "ERROR: SESSION_SECRET environment variable is not set!"
  exit 1
else
  echo "SESSION_SECRET is set (value hidden for security)"
fi

# Create or update .env.local with SESSION_SECRET
echo "Creating .env.local with SESSION_SECRET"
echo "SESSION_SECRET=${SESSION_SECRET}" > .env.local

# Try to set the Wrangler Pages environment variable (ignore errors if it fails)
echo "Setting Wrangler Pages environment variable for SESSION_SECRET"
echo "Note: This may fail in CI environments but the app has fallbacks"

# For local development, create a .dev.vars file that Wrangler will use
echo "SESSION_SECRET=${SESSION_SECRET}" > .dev.vars
echo "Created .dev.vars file with SESSION_SECRET for local development"

# Try to set the environment variable in Wrangler Pages project
# This requires authentication and may fail in CI environments
wrangler pages project env put SESSION_SECRET --project-name bolt --env production || true

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
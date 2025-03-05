#!/bin/bash
set -e

echo "===== Bolt.diy Coolify Setup Script ====="

# Generate a secure SESSION_SECRET if not provided
if [ -z "${SESSION_SECRET}" ]; then
  echo "SESSION_SECRET not provided, generating a secure random value"
  export SESSION_SECRET=$(openssl rand -base64 32)
  echo "Generated SESSION_SECRET (value hidden for security)"
else
  echo "Using provided SESSION_SECRET"
fi

# Ensure SESSION_SECRET is available in multiple places

# 1. Create .env.local file
echo "Creating .env.local file"
cat > .env.local << EOF
SESSION_SECRET=${SESSION_SECRET}
# Other environment variables can be added here
EOF

# 2. Set Wrangler secret
echo "Setting Wrangler secret"
echo "${SESSION_SECRET}" | wrangler secret put SESSION_SECRET --stdin --no-interactive || true

# 3. Ensure it's passed to docker-compose
echo "Ensuring SESSION_SECRET is available for docker-compose"
export SESSION_SECRET=${SESSION_SECRET}

echo "Setup complete. Starting application..."

# Start the application using docker-compose
docker-compose -f docker-compose-coolify.yaml up -d

echo "Application started. Check logs with: docker-compose -f docker-compose-coolify.yaml logs -f app"

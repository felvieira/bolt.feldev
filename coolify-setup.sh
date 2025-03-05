#!/bin/bash
set -e

echo "===== Bolt.diy Coolify Setup Script ====="

# Validate Coolify Environment
echo "Validating Coolify environment..."

# Generate a secure SESSION_SECRET if not provided
if [ -z "${SESSION_SECRET}" ]; then
  echo "SESSION_SECRET not provided, generating a secure random value"
  export SESSION_SECRET=$(openssl rand -base64 32)
  echo "Generated SESSION_SECRET (value hidden for security)"
  
  # Make the SESSION_SECRET available to Coolify
  if [ -f ".coolify/.env" ]; then
    echo "Adding SESSION_SECRET to Coolify environment"
    grep -q "SESSION_SECRET=" .coolify/.env && sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" .coolify/.env || echo "SESSION_SECRET=${SESSION_SECRET}" >> .coolify/.env
  fi
else
  echo "Using provided SESSION_SECRET"
fi

# Create necessary directories
mkdir -p ./bolt-env

# Ensure SESSION_SECRET is available in multiple places

# 1. Create .env.local file
echo "Creating .env.local file"
cat > .env.local << EOF
SESSION_SECRET=${SESSION_SECRET}
# Other environment variables are set via Coolify
EOF

# Make a copy for the volume mount
cp .env.local ./bolt-env/.env.local

# 2. Set Wrangler secret (try multiple approaches)
echo "Setting Wrangler secret via direct approach"
echo "${SESSION_SECRET}" | wrangler secret put SESSION_SECRET --stdin --no-interactive || true

# 3. Also try setting it through a temporary file for non-interactive environments
echo "Setting Wrangler secret via file approach"
echo "${SESSION_SECRET}" > .secret_temp
wrangler secret put SESSION_SECRET --name bolt < .secret_temp || true
rm .secret_temp

# 4. Ensure it's passed to docker-compose
echo "Ensuring SESSION_SECRET is available for docker-compose"
export SESSION_SECRET=${SESSION_SECRET}

# 5. Make shell scripts executable
echo "Making shell scripts executable"
chmod +x ./entrypoint.sh ./bindings.sh ./postdeploy.sh 2>/dev/null || true

echo "Setup complete. Starting application..."

# Start the application using docker-compose
if [ "$1" == "run" ]; then
  echo "Running docker-compose directly"
  docker-compose -f docker-compose-coolify.yaml up -d
  echo "Application started. Check logs with: docker-compose -f docker-compose-coolify.yaml logs -f app"
else
  echo "Setup complete. Deploy via Coolify dashboard to start the application."
fi

# Verify the setup
echo "Setup verification:"
echo "- .env.local file created: $([ -f .env.local ] && echo 'Yes' || echo 'No')"
echo "- bolt-env directory created: $([ -d ./bolt-env ] && echo 'Yes' || echo 'No')"
echo "- SESSION_SECRET in environment: $([ -n \"${SESSION_SECRET}\" ] && echo 'Yes' || echo 'No')"

echo "===== Setup Complete ====="
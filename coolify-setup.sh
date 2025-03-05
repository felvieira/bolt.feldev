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

# 2. Create .dev.vars file for Wrangler Pages
echo "Creating .dev.vars file for Wrangler Pages"
echo "SESSION_SECRET=${SESSION_SECRET}" > .dev.vars
echo "Created .dev.vars file with SESSION_SECRET for local development"

# 3. Export to environment to ensure it's available for the build process
echo "Ensuring SESSION_SECRET is available in the environment"
export SESSION_SECRET=${SESSION_SECRET}

# 4. Make shell scripts executable
echo "Making shell scripts executable"
chmod +x ./entrypoint.sh ./bindings.sh ./postdeploy.sh 2>/dev/null || true

# Verify the setup
echo "Setup verification:"
echo "- .env.local file created: $([ -f .env.local ] && echo 'Yes' || echo 'No')"
echo "- .dev.vars file created: $([ -f .dev.vars ] && echo 'Yes' || echo 'No')"
echo "- bolt-env directory created: $([ -d ./bolt-env ] && echo 'Yes' || echo 'No')"
echo "- SESSION_SECRET in environment: $([ -n \"${SESSION_SECRET}\" ] && echo 'Yes' || echo 'No')"

echo "===== Setup Complete ====="
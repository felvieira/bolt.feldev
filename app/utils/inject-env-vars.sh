#!/bin/bash
set -e

echo "★═══════════════════════════════════════★"
echo "      BOLT.DIY ENVIRONMENT INJECTOR     "
echo "★═══════════════════════════════════════★"

ENV_FILE=".env.local"
ENV_RUNTIME_FILE=".env"

# Check for required environment variables
REQUIRED_VARS=("SESSION_SECRET" "SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "WARNING: The following required environment variables are missing:"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "Attempting to load from environment files..."
fi

# Generate SESSION_SECRET if not present
if [ -z "${SESSION_SECRET}" ]; then
  echo "SESSION_SECRET not defined, generating a secure value"
  export SESSION_SECRET=$(openssl rand -base64 32)
  echo "Generated new SESSION_SECRET (value hidden)"
fi

# Function to update environment files
update_env_file() {
  file=$1
  echo "Updating $file with current environment variables"
  
  # Create file if it doesn't exist
  touch "$file"
  
  # List of all environment variables to include
  ENV_VARS=(
    "SESSION_SECRET"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY" 
    "SUPABASE_SERVICE_KEY"
    "DATABASE_URL"
    "NODE_ENV"
    "RUNNING_IN_DOCKER"
    "DEFAULT_NUM_CTX"
    "GROQ_API_KEY"
    "HuggingFace_API_KEY"
    "OPENAI_API_KEY"
    "ANTHROPIC_API_KEY"
    "OPEN_ROUTER_API_KEY" 
    "GOOGLE_GENERATIVE_AI_API_KEY"
    "OLLAMA_API_BASE_URL"
    "OPENAI_LIKE_API_BASE_URL"
    "OPENAI_LIKE_API_KEY"
    "TOGETHER_API_BASE_URL"
    "TOGETHER_API_KEY"
    "DEEPSEEK_API_KEY"
    "HYPERBOLIC_API_KEY"
    "HYPERBOLIC_API_BASE_URL"
    "MISTRAL_API_KEY"
    "COHERE_API_KEY"
    "LMSTUDIO_API_BASE_URL"
    "XAI_API_KEY"
    "PERPLEXITY_API_KEY"
    "AWS_BEDROCK_CONFIG"
    "VITE_LOG_LEVEL"
  )
  
  # Create a backup of the original file
  if [ -f "$file" ]; then
    cp "$file" "${file}.bak"
  fi
  
  # Start with a clean file
  echo "# BOLT.DIY Environment Configuration" > "$file"
  echo "# Auto-generated on $(date)" >> "$file"
  echo "" >> "$file"
  
  # Add each variable to the file
  for var in "${ENV_VARS[@]}"; do
    # Only add variables that are set
    if [ -n "${!var}" ]; then
      echo "${var}=${!var}" >> "$file"
    fi
  done
  
  echo "Updated $file with $(grep -c "=" "$file") environment variables"
}

# Update both environment files
update_env_file "$ENV_FILE"
update_env_file "$ENV_RUNTIME_FILE"

# Also create a .env file for production Node.js
if [ "$NODE_ENV" = "production" ]; then
  update_env_file ".env"
  echo "Created production .env file"
fi

echo "★═══════════════════════════════════════★"
echo "Environment variables successfully injected"
echo "★═══════════════════════════════════════★"

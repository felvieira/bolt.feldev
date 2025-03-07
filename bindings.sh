#!/bin/bash
set -euo pipefail

bindings=""

# Function to extract variable names from worker-configuration.d.ts
extract_env_vars() {
  if [ -f "worker-configuration.d.ts" ]; then
    grep -o '[A-Z_]\+:' worker-configuration.d.ts | sed 's/://'
  else
    # Fallback to a predefined list of common variables if file doesn't exist
    echo "SESSION_SECRET SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY DATABASE_URL"
  fi
}

# Function to safely add a binding with proper quoting
add_binding() {
  local name="$1"
  local value="$2"
  
  # Skip empty values
  if [ -z "$value" ]; then
    return
  fi
  
  # Escape any quotes in the value and wrap in quotes
  value=$(echo "$value" | sed 's/"/\\"/g')
  bindings+="--binding ${name}=\"${value}\" "
}

echo "Generating bindings..."

# Critical variables to check and log (without revealing values)
critical_vars=("SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_KEY" "SESSION_SECRET")
for var in "${critical_vars[@]}"; do
  if [ -n "${!var-}" ]; then
    echo "✓ Found $var in environment"
  else
    echo "⚠ Missing $var in environment"
  fi
done

# If .env.local exists, read variables from it
if [ -f ".env.local" ]; then
  echo "Reading variables from .env.local"
  
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    if [[ ! "$line" =~ ^[[:space:]]*# ]] && [[ -n "$line" ]]; then
      # Use regex to split at first equals sign, preserving the rest
      if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
        name="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        
        # Remove surrounding quotes if present
        value=$(echo "$value" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/")
        
        add_binding "$name" "$value"
      fi
    fi
  done < .env.local
  
else
  # If .env.local doesn't exist, use environment variables
  echo "No .env.local found, using environment variables"
  
  # Use variables from worker-configuration.d.ts or fallback list
  for var in $(extract_env_vars); do
    if [ -n "${!var-}" ]; then
      add_binding "$var" "${!var}"
    fi
  done
  
  # Ensure critical Supabase variables are always included
  for var in "${critical_vars[@]}"; do
    if [ -n "${!var-}" ] && [[ ! "$bindings" =~ "--binding $var=" ]]; then
      add_binding "$var" "${!var}"
    fi
  done
fi

# Trim trailing whitespace
bindings=$(echo "$bindings" | sed 's/[[:space:]]*$//')

echo "Generated bindings for Wrangler"
echo "$bindings"

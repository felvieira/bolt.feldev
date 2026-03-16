CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  visibility VARCHAR(20) DEFAULT 'private',
  share_slug VARCHAR(100) UNIQUE,
  chat_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_chat_id ON projects(chat_id);

CREATE TABLE IF NOT EXISTS project_hosting (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'self',
  domain VARCHAR(255),
  netlify_site_id VARCHAR(255),
  vercel_project_id VARCHAR(255),
  self_container_id VARCHAR(255),
  last_deploy_at TIMESTAMPTZ,
  deploy_status VARCHAR(20) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS project_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, key)
);

CREATE TABLE IF NOT EXISTS project_databases (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  supabase_url VARCHAR(500),
  supabase_anon_key TEXT,
  local_db_name VARCHAR(100),
  connection_string_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- migrations.sql
-- Criação da tabela "chats" para armazenar o histórico de conversas dos usuários

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  messages JSONB NOT NULL,
  url_id TEXT UNIQUE NOT NULL,
  description TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  CONSTRAINT fk_user
    FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
);

-- Criação de índices para otimizar as consultas
CREATE INDEX IF NOT EXISTS idx_chats_url_id ON chats (url_id);
CREATE INDEX IF NOT EXISTS idx_chats_timestamp ON chats (timestamp);

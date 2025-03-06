-- migrations.sql
-- Verificar se o schema auth existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
        RAISE EXCEPTION 'O schema "auth" não existe. Verifique se o Supabase Auth está configurado corretamente.';
    END IF;
END
$$;

-- Verificar se a tabela auth.users existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        RAISE EXCEPTION 'A tabela "auth.users" não existe. Verifique se o Supabase Auth está configurado corretamente.';
    END IF;
END
$$;

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

-- Log de sucesso
DO $$
BEGIN
    RAISE NOTICE 'Migração concluída com sucesso. Tabela "chats" e índices criados.';
END
$$;

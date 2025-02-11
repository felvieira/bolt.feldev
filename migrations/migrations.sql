-- migrations.sql
-- Script de migração para o banco de dados do Bolt.diy
-- Cria a tabela que armazena o histórico de chats

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  messages JSONB NOT NULL,
  url_id TEXT UNIQUE NOT NULL,
  description TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Índices para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_chats_url_id ON chats (url_id);
CREATE INDEX IF NOT EXISTS idx_chats_timestamp ON chats (timestamp);

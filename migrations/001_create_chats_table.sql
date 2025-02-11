CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,            -- to associate the chat with a user
  url_id TEXT UNIQUE NOT NULL,        -- a friendly id for navigation
  description TEXT,
  messages JSONB NOT NULL,            -- store the messages as JSON
  timestamp TIMESTAMPTZ DEFAULT NOW(),-- record creation/update time
  metadata JSONB                      -- additional chat metadata
);

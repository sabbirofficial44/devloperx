-- DeveloperX — Supabase Database Setup
-- Project: vvanidgemgdhgtsunlzy

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  plan TEXT DEFAULT 'trial',
  credit_hours INTEGER DEFAULT 5,
  credit_minutes INTEGER DEFAULT 0,
  minutes_used FLOAT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  disabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  trial_hours INTEGER DEFAULT 5,
  trial_used BOOLEAN DEFAULT false
);

-- Global cookies table
CREATE TABLE IF NOT EXISTS global_cookies (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cookies JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Credit ledger table
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  amount FLOAT,
  unit TEXT DEFAULT 'minutes',
  reason TEXT,
  source TEXT DEFAULT 'extension',
  balance_after_minutes FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default cookie row if not exists
INSERT INTO global_cookies (cookies) VALUES ('[]'::jsonb);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_cookies ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

-- Service role bypass (using service_role key)
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON global_cookies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON credit_ledger FOR ALL USING (true) WITH CHECK (true);

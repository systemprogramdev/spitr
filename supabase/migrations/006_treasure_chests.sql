-- Add last_chest_claimed_at to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_chest_claimed_at TIMESTAMPTZ DEFAULT NULL;

-- Create user_chests table
CREATE TABLE IF NOT EXISTS user_chests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened BOOLEAN NOT NULL DEFAULT FALSE,
  loot JSONB DEFAULT NULL,
  opened_at TIMESTAMPTZ DEFAULT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_chests_user_id ON user_chests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_chests_user_unopened ON user_chests(user_id) WHERE opened = FALSE;

-- RLS
ALTER TABLE user_chests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chests"
  ON user_chests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chests"
  ON user_chests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chests"
  ON user_chests FOR UPDATE
  USING (auth.uid() = user_id);

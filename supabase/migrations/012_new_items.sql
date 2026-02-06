-- 012: New items (soda, nuke, firewall, kevlar, spray paint) + defense buffs + spray paints

-- Extend item_type enum
ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'soda';
ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'nuke';
ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'firewall';
ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'kevlar';
ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'spray_paint';

-- User buffs (firewall, kevlar)
CREATE TABLE IF NOT EXISTS user_buffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  buff_type TEXT NOT NULL,
  charges_remaining INT NOT NULL DEFAULT 1,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, buff_type)
);

ALTER TABLE user_buffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read buffs" ON user_buffs FOR SELECT USING (true);
CREATE POLICY "Users can insert own buffs" ON user_buffs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own buffs" ON user_buffs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own buffs" ON user_buffs FOR DELETE USING (auth.uid() = user_id);

-- Spray paints
CREATE TABLE IF NOT EXISTS spray_paints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprayer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  sprayed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE spray_paints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read sprays" ON spray_paints FOR SELECT USING (true);
CREATE POLICY "Users can insert sprays" ON spray_paints FOR INSERT WITH CHECK (auth.uid() = sprayer_id);

-- Index for querying active sprays
CREATE INDEX IF NOT EXISTS idx_spray_paints_target ON spray_paints(target_user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_buffs_user ON user_buffs(user_id);

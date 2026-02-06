-- ============================================================
-- Migration 011: XP System, Bookmarks, Quote Respits, Kill Feed RLS
-- ============================================================

-- ==================== XP SYSTEM ====================

-- User XP table (one row per user)
CREATE TABLE IF NOT EXISTS user_xp (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;

-- Everyone can read XP (leaderboard)
CREATE POLICY "Anyone can view user XP"
  ON user_xp FOR SELECT
  USING (true);

-- Users can update own XP (via RPC only in practice)
CREATE POLICY "Users can update own XP"
  ON user_xp FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- XP transaction log
CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  action TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own XP transactions"
  ON xp_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_user_xp_level ON user_xp(level DESC, xp DESC);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id, created_at DESC);

-- Award XP RPC (atomic: upsert XP, recalculate level, log transaction)
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_amount INT,
  p_action TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_xp INT;
  v_old_level INT;
  v_new_level INT;
  v_leveled_up BOOLEAN := FALSE;
BEGIN
  -- Upsert user_xp row
  INSERT INTO user_xp (user_id, xp, level, updated_at)
  VALUES (p_user_id, p_amount, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET xp = user_xp.xp + p_amount,
        updated_at = NOW()
  RETURNING xp INTO v_new_xp;

  -- Get old level
  SELECT level INTO v_old_level FROM user_xp WHERE user_id = p_user_id;

  -- Calculate new level: floor((1 + sqrt(1 + xp/12.5)) / 2)
  v_new_level := GREATEST(1, FLOOR((1.0 + SQRT(1.0 + v_new_xp::NUMERIC / 12.5)) / 2.0)::INT);

  -- Update level if changed
  IF v_new_level != v_old_level THEN
    UPDATE user_xp SET level = v_new_level WHERE user_id = p_user_id;
    v_leveled_up := TRUE;
  END IF;

  -- Log transaction
  INSERT INTO xp_transactions (user_id, amount, action, reference_id)
  VALUES (p_user_id, p_amount, p_action, p_reference_id);

  RETURN jsonb_build_object(
    'success', TRUE,
    'xp', v_new_xp,
    'level', v_new_level,
    'leveled_up', v_leveled_up
  );
END;
$$;

-- ==================== BOOKMARKS ====================

CREATE TABLE IF NOT EXISTS user_bookmarks (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spit_id UUID NOT NULL REFERENCES spits(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, spit_id)
);

ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks"
  ON user_bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON user_bookmarks(user_id, created_at DESC);

-- ==================== QUOTE RESPITS ====================

ALTER TABLE spits ADD COLUMN IF NOT EXISTS quote_spit_id UUID REFERENCES spits(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_spits_quote ON spits(quote_spit_id) WHERE quote_spit_id IS NOT NULL;

-- ==================== KILL FEED / LEADERBOARD RLS ====================

-- Public read access on attack_log for kill feed
-- (Drop existing restrictive policy if any, then create public read)
DO $$
BEGIN
  -- Try to create public read policy; if it already exists, skip
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'attack_log' AND policyname = 'Anyone can view attack log'
  ) THEN
    CREATE POLICY "Anyone can view attack log"
      ON attack_log FOR SELECT
      USING (true);
  END IF;
END;
$$;

-- Public read access on user_credits balance for "richest" leaderboard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Anyone can view credit balances'
  ) THEN
    CREATE POLICY "Anyone can view credit balances"
      ON user_credits FOR SELECT
      USING (true);
  END IF;
END;
$$;

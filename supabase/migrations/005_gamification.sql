-- ============================================
-- 005_gamification.sql
-- Gold currency, shop, weapons, potions, HP, attack mechanics
-- ============================================

-- New enums
DO $$ BEGIN
  CREATE TYPE gold_transaction_type AS ENUM ('purchase', 'convert', 'item_purchase');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE item_type AS ENUM ('knife', 'gun', 'soldier', 'drone', 'small_potion', 'medium_potion', 'large_potion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'attack';

-- ============================================
-- NEW TABLES
-- ============================================

-- User gold balances
CREATE TABLE IF NOT EXISTS user_gold (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gold transaction log
CREATE TABLE IF NOT EXISTS gold_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type gold_transaction_type NOT NULL,
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User inventory
CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type item_type NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  UNIQUE(user_id, item_type)
);

-- Attack log
CREATE TABLE IF NOT EXISTS attack_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_spit_id UUID REFERENCES spits(id) ON DELETE SET NULL,
  item_type item_type NOT NULL,
  damage INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ALTER EXISTING TABLES
-- ============================================

-- Add HP and destroyed flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS hp INT NOT NULL DEFAULT 5000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_destroyed BOOLEAN NOT NULL DEFAULT false;

-- Add HP to spits
ALTER TABLE spits ADD COLUMN IF NOT EXISTS hp INT NOT NULL DEFAULT 10;

-- Add reference_id to notifications (for conversation_id / item_type)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id TEXT;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_gold_transactions_user ON gold_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attack_log_attacker ON attack_log(attacker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attack_log_target_user ON attack_log(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attack_log_target_spit ON attack_log(target_spit_id, created_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE user_gold ENABLE ROW LEVEL SECURITY;
ALTER TABLE gold_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_log ENABLE ROW LEVEL SECURITY;

-- user_gold: users can view/insert/update own
CREATE POLICY "Users can view own gold" ON user_gold FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gold" ON user_gold FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gold" ON user_gold FOR UPDATE USING (auth.uid() = user_id);

-- gold_transactions: users can view/insert own
CREATE POLICY "Users can view own gold transactions" ON gold_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gold transactions" ON gold_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_inventory: users can view/insert/update own
CREATE POLICY "Users can view own inventory" ON user_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inventory" ON user_inventory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory" ON user_inventory FOR UPDATE USING (auth.uid() = user_id);

-- attack_log: involved parties can view, authenticated users can insert own attacks
CREATE POLICY "Users can view attacks involving them" ON attack_log FOR SELECT
  USING (auth.uid() = attacker_id OR auth.uid() = target_user_id);
CREATE POLICY "Users can insert own attacks" ON attack_log FOR INSERT
  WITH CHECK (auth.uid() = attacker_id);

-- ============================================
-- SERVER-SIDE FUNCTIONS (SECURITY DEFINER)
-- ============================================

-- perform_attack: validates inventory, deducts item, applies damage, logs attack
CREATE OR REPLACE FUNCTION perform_attack(
  p_attacker_id UUID,
  p_target_user_id UUID DEFAULT NULL,
  p_target_spit_id UUID DEFAULT NULL,
  p_item_type item_type DEFAULT NULL,
  p_damage INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_qty INT;
  v_new_hp INT;
  v_target_destroyed BOOLEAN := false;
BEGIN
  -- Must have a target
  IF p_target_user_id IS NULL AND p_target_spit_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No target specified');
  END IF;

  -- Check inventory
  SELECT quantity INTO v_qty
  FROM user_inventory
  WHERE user_id = p_attacker_id AND item_type = p_item_type;

  IF v_qty IS NULL OR v_qty < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient inventory');
  END IF;

  -- Deduct item from inventory
  UPDATE user_inventory
  SET quantity = quantity - 1
  WHERE user_id = p_attacker_id AND item_type = p_item_type;

  -- Apply damage to target
  IF p_target_spit_id IS NOT NULL THEN
    UPDATE spits
    SET hp = GREATEST(0, hp - p_damage)
    WHERE id = p_target_spit_id
    RETURNING hp INTO v_new_hp;
  END IF;

  IF p_target_user_id IS NOT NULL THEN
    UPDATE users
    SET hp = GREATEST(0, hp - p_damage),
        is_destroyed = CASE WHEN GREATEST(0, hp - p_damage) = 0 THEN true ELSE is_destroyed END
    WHERE id = p_target_user_id
    RETURNING hp, is_destroyed INTO v_new_hp, v_target_destroyed;
  END IF;

  -- Log the attack
  INSERT INTO attack_log (attacker_id, target_user_id, target_spit_id, item_type, damage)
  VALUES (p_attacker_id, p_target_user_id, p_target_spit_id, p_item_type, p_damage);

  RETURN jsonb_build_object(
    'success', true,
    'new_hp', COALESCE(v_new_hp, 0),
    'destroyed', v_target_destroyed,
    'damage', p_damage
  );
END;
$$;

-- use_potion: validates inventory, heals user (capped at 5000)
CREATE OR REPLACE FUNCTION use_potion(
  p_user_id UUID,
  p_item_type item_type,
  p_heal_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_qty INT;
  v_current_hp INT;
  v_new_hp INT;
BEGIN
  -- Check inventory
  SELECT quantity INTO v_qty
  FROM user_inventory
  WHERE user_id = p_user_id AND item_type = p_item_type;

  IF v_qty IS NULL OR v_qty < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient inventory');
  END IF;

  -- Get current HP
  SELECT hp INTO v_current_hp FROM users WHERE id = p_user_id;

  IF v_current_hp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Can't heal if destroyed
  IF v_current_hp = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is destroyed');
  END IF;

  -- Calculate new HP (cap at 5000)
  v_new_hp := LEAST(5000, v_current_hp + p_heal_amount);

  -- Deduct item
  UPDATE user_inventory
  SET quantity = quantity - 1
  WHERE user_id = p_user_id AND item_type = p_item_type;

  -- Apply healing
  UPDATE users
  SET hp = v_new_hp
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_hp', v_new_hp,
    'healed', v_new_hp - v_current_hp
  );
END;
$$;

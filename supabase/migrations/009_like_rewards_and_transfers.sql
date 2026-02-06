-- ============================================
-- 009_like_rewards_and_transfers.sql
-- Like reward tracking + spit transfer system
-- ============================================

-- ============================================
-- EXTEND ENUMS
-- ============================================
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'convert';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'like_reward';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'transfer_sent';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'transfer_received';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'like_reward';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'transfer';

-- ============================================
-- LIKE REWARDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS like_rewards (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spit_id UUID NOT NULL REFERENCES spits(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, spit_id)
);

ALTER TABLE like_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own like rewards"
  ON like_rewards FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_like_rewards_spit ON like_rewards(spit_id);

-- ============================================
-- LIKE REWARD RPC
-- Idempotent: each user can only reward a spit once
-- Anti-gaming: no self-likes, no re-like farming
-- ============================================
CREATE OR REPLACE FUNCTION handle_like_reward(
  p_liker_id UUID,
  p_spit_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_spit_author_id UUID;
  v_rows_inserted INT;
  v_new_hp INT;
  v_new_balance INT;
BEGIN
  -- Get spit author
  SELECT user_id INTO v_spit_author_id
  FROM spits WHERE id = p_spit_id;

  IF v_spit_author_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Spit not found');
  END IF;

  -- No reward for liking own spit
  IF p_liker_id = v_spit_author_id THEN
    RETURN jsonb_build_object('success', true, 'rewarded', false);
  END IF;

  -- Idempotent insert: only rewards on first-time like
  INSERT INTO like_rewards (user_id, spit_id)
  VALUES (p_liker_id, p_spit_id)
  ON CONFLICT (user_id, spit_id) DO NOTHING;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  -- ROW_COUNT = 0 means already rewarded (conflict)
  IF v_rows_inserted = 0 THEN
    RETURN jsonb_build_object('success', true, 'rewarded', false);
  END IF;

  -- +5 HP to spit (capped at 100)
  UPDATE spits
  SET hp = LEAST(100, hp + 5)
  WHERE id = p_spit_id
  RETURNING hp INTO v_new_hp;

  -- +1 credit to spit author
  UPDATE user_credits
  SET balance = balance + 1, updated_at = NOW()
  WHERE user_id = v_spit_author_id
  RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    INSERT INTO user_credits (user_id, balance)
    VALUES (v_spit_author_id, 1)
    RETURNING balance INTO v_new_balance;
  END IF;

  -- Log the credit transaction
  INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (v_spit_author_id, 'like_reward', 1, v_new_balance, p_spit_id::TEXT);

  RETURN jsonb_build_object(
    'success', true,
    'rewarded', true,
    'new_hp', COALESCE(v_new_hp, 0),
    'author_id', v_spit_author_id
  );
END;
$$;

-- ============================================
-- TRANSFER SPITS RPC
-- Atomic credit transfer with row-level locking
-- ============================================
CREATE OR REPLACE FUNCTION transfer_spits(
  p_sender_id UUID,
  p_recipient_id UUID,
  p_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender_balance INT;
  v_new_sender_balance INT;
  v_new_recipient_balance INT;
BEGIN
  -- Validation
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot send to yourself');
  END IF;

  -- Check recipient exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_recipient_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found');
  END IF;

  -- Lock sender row and check balance
  SELECT balance INTO v_sender_balance
  FROM user_credits
  WHERE user_id = p_sender_id
  FOR UPDATE;

  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct from sender
  v_new_sender_balance := v_sender_balance - p_amount;
  UPDATE user_credits
  SET balance = v_new_sender_balance, updated_at = NOW()
  WHERE user_id = p_sender_id;

  -- Add to recipient (upsert)
  UPDATE user_credits
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = p_recipient_id
  RETURNING balance INTO v_new_recipient_balance;

  IF NOT FOUND THEN
    INSERT INTO user_credits (user_id, balance)
    VALUES (p_recipient_id, p_amount)
    RETURNING balance INTO v_new_recipient_balance;
  END IF;

  -- Log transactions for both parties
  INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES
    (p_sender_id, 'transfer_sent', -p_amount, v_new_sender_balance, p_recipient_id::TEXT),
    (p_recipient_id, 'transfer_received', p_amount, v_new_recipient_balance, p_sender_id::TEXT);

  RETURN jsonb_build_object(
    'success', true,
    'new_sender_balance', v_new_sender_balance
  );
END;
$$;

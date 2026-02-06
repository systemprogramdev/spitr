-- ============================================
-- 010_transfer_limits_and_buy_chest.sql
-- Daily transfer limits with HP penalty + purchasable chests
-- ============================================

-- ============================================
-- EXTEND ENUMS
-- ============================================
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'chest_purchase';

-- ============================================
-- UPDATE transfer_spits WITH DAILY LIMITS + HP PENALTY
-- Max 100 spits sent per day, max 100 received per day.
-- Every spit over the limit costs 100 HP to the sender.
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
  v_sent_today INT;
  v_received_today INT;
  v_send_overage INT;
  v_receive_overage INT;
  v_overage INT;
  v_hp_penalty INT;
  v_new_hp INT;
BEGIN
  -- Validation
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_sender_id = p_recipient_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot send to yourself');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_recipient_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found');
  END IF;

  -- Calculate daily sent total for sender (last 24h)
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_sent_today
  FROM credit_transactions
  WHERE user_id = p_sender_id
    AND type = 'transfer_sent'
    AND created_at >= NOW() - INTERVAL '24 hours';

  -- Calculate daily received total for recipient (last 24h)
  SELECT COALESCE(SUM(amount), 0) INTO v_received_today
  FROM credit_transactions
  WHERE user_id = p_recipient_id
    AND type = 'transfer_received'
    AND created_at >= NOW() - INTERVAL '24 hours';

  -- Lock sender row and check balance
  SELECT balance INTO v_sender_balance
  FROM user_credits
  WHERE user_id = p_sender_id
  FOR UPDATE;

  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Calculate overage from both limits (100/day)
  v_send_overage := GREATEST(0, (v_sent_today + p_amount) - 100);
  v_receive_overage := GREATEST(0, (v_received_today + p_amount) - 100);
  v_overage := GREATEST(v_send_overage, v_receive_overage);

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
    (p_sender_id, 'transfer_sent', -p_amount, v_new_sender_balance, p_recipient_id),
    (p_recipient_id, 'transfer_received', p_amount, v_new_recipient_balance, p_sender_id);

  -- Apply HP penalty if over daily limit (100 HP per 1 spit over)
  v_hp_penalty := 0;
  v_new_hp := -1;
  IF v_overage > 0 THEN
    v_hp_penalty := v_overage * 100;
    UPDATE users
    SET hp = GREATEST(0, hp - v_hp_penalty)
    WHERE id = p_sender_id
    RETURNING hp INTO v_new_hp;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_sender_balance', v_new_sender_balance,
    'hp_penalty', v_hp_penalty,
    'new_hp', v_new_hp,
    'sent_today', v_sent_today + p_amount,
    'received_today', v_received_today + p_amount
  );
END;
$$;

-- ============================================
-- BUY CHEST RPC
-- Atomic: deducts 100 credits + creates chest in one transaction
-- ============================================
CREATE OR REPLACE FUNCTION buy_chest(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INT;
  v_new_balance INT;
  v_chest_id UUID;
BEGIN
  -- Lock and check balance
  SELECT balance INTO v_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient spits');
  END IF;

  -- Deduct 100 credits
  v_new_balance := v_balance - 100;
  UPDATE user_credits
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Create chest
  INSERT INTO user_chests (user_id)
  VALUES (p_user_id)
  RETURNING id INTO v_chest_id;

  -- Log transaction
  INSERT INTO credit_transactions (user_id, type, amount, balance_after)
  VALUES (p_user_id, 'chest_purchase', -100, v_new_balance);

  RETURN jsonb_build_object(
    'success', true,
    'chest_id', v_chest_id,
    'new_balance', v_new_balance
  );
END;
$$;

-- ============================================
-- 019_transfer_gold.sql
-- Gold transfer RPC with daily limits (no HP penalty)
-- ============================================
-- PRE-REQ: Run these manually in Supabase SQL editor first
-- (ALTER TYPE ADD VALUE cannot run inside a transaction):
--   ALTER TYPE gold_transaction_type ADD VALUE IF NOT EXISTS 'transfer_sent';
--   ALTER TYPE gold_transaction_type ADD VALUE IF NOT EXISTS 'transfer_received';
-- ============================================

CREATE OR REPLACE FUNCTION transfer_gold(
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
  FROM gold_transactions
  WHERE user_id = p_sender_id
    AND type = 'transfer_sent'
    AND created_at >= NOW() - INTERVAL '24 hours';

  -- Hard limit: 10 gold per day
  IF v_sent_today + p_amount > 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily gold transfer limit exceeded (10/day)',
      'sent_today', v_sent_today,
      'limit', 10
    );
  END IF;

  -- Lock sender row and check balance
  SELECT balance INTO v_sender_balance
  FROM user_gold
  WHERE user_id = p_sender_id
  FOR UPDATE;

  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient gold');
  END IF;

  -- Deduct from sender
  v_new_sender_balance := v_sender_balance - p_amount;
  UPDATE user_gold
  SET balance = v_new_sender_balance, updated_at = NOW()
  WHERE user_id = p_sender_id;

  -- Add to recipient (upsert)
  UPDATE user_gold
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = p_recipient_id
  RETURNING balance INTO v_new_recipient_balance;

  IF NOT FOUND THEN
    INSERT INTO user_gold (user_id, balance)
    VALUES (p_recipient_id, p_amount)
    RETURNING balance INTO v_new_recipient_balance;
  END IF;

  -- Log transactions for both parties
  INSERT INTO gold_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES
    (p_sender_id, 'transfer_sent', -p_amount, v_new_sender_balance, p_recipient_id::TEXT),
    (p_recipient_id, 'transfer_received', p_amount, v_new_recipient_balance, p_sender_id::TEXT);

  RETURN jsonb_build_object(
    'success', true,
    'new_sender_balance', v_new_sender_balance,
    'sent_today', v_sent_today + p_amount
  );
END;
$$;

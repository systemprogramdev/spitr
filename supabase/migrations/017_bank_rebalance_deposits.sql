-- Fix: After withdrawal, rebalance deposits so interest only accrues on remaining balance
-- Previously: withdrawn tracked separately, but interest still calculated on original principal
-- Now: after taking from a deposit, set principal = remaining, withdrawn = 0, deposited_at = NOW()
-- If remaining < 0.01, delete the row entirely

-- 1. bank_withdraw
CREATE OR REPLACE FUNCTION bank_withdraw(
  p_user_id UUID,
  p_currency TEXT,
  p_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining NUMERIC(20,5);
  v_deposit RECORD;
  v_interest NUMERIC(20,5);
  v_available NUMERIC(20,5);
  v_take NUMERIC(20,5);
  v_leftover NUMERIC(20,5);
  v_new_wallet INT;
  v_total_withdrawn NUMERIC(20,5) := 0;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_currency NOT IN ('spit', 'gold') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid currency');
  END IF;

  v_remaining := p_amount::NUMERIC;

  FOR v_deposit IN
    SELECT id, principal, locked_rate, deposited_at, withdrawn
    FROM bank_deposits
    WHERE user_id = p_user_id AND currency = p_currency
      AND withdrawn < principal + (principal * locked_rate * EXTRACT(EPOCH FROM (NOW() - deposited_at)) / 86400.0)
    ORDER BY deposited_at DESC
    FOR UPDATE
  LOOP
    v_interest := FLOOR(
      (v_deposit.principal * v_deposit.locked_rate *
       EXTRACT(EPOCH FROM (NOW() - v_deposit.deposited_at)) / 86400.0) * 100000
    ) / 100000;
    v_available := v_deposit.principal + v_interest - v_deposit.withdrawn;

    IF v_available <= 0 THEN
      DELETE FROM bank_deposits WHERE id = v_deposit.id;
      CONTINUE;
    END IF;

    v_take := LEAST(v_remaining, v_available);
    v_leftover := v_available - v_take;

    IF v_leftover < 0.01 THEN
      -- Fully consumed: delete the deposit
      DELETE FROM bank_deposits WHERE id = v_deposit.id;
    ELSE
      -- Rebalance: principal = remaining, reset withdrawn and deposited_at
      UPDATE bank_deposits
      SET principal = v_leftover, withdrawn = 0, deposited_at = NOW()
      WHERE id = v_deposit.id;
    END IF;

    v_total_withdrawn := v_total_withdrawn + v_take;
    v_remaining := v_remaining - v_take;

    IF v_remaining <= 0 THEN
      EXIT;
    END IF;
  END LOOP;

  IF v_total_withdrawn = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No funds available to withdraw');
  END IF;

  IF p_currency = 'spit' THEN
    UPDATE user_credits
    SET balance = balance + FLOOR(v_total_withdrawn)::INT, updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_wallet;
  ELSE
    UPDATE user_gold
    SET balance = balance + FLOOR(v_total_withdrawn)::INT, updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_wallet;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawn', FLOOR(v_total_withdrawn),
    'new_wallet_balance', v_new_wallet
  );
END;
$$;

-- 2. bank_buy_stock
CREATE OR REPLACE FUNCTION bank_buy_stock(
  p_user_id UUID,
  p_spit_amount NUMERIC(20,5),
  p_price_per_share NUMERIC(20,5)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining NUMERIC(20,5);
  v_deposit RECORD;
  v_interest NUMERIC(20,5);
  v_available NUMERIC(20,5);
  v_take NUMERIC(20,5);
  v_leftover NUMERIC(20,5);
  v_total_taken NUMERIC(20,5) := 0;
  v_shares NUMERIC(20,5);
  v_new_shares NUMERIC(20,5);
BEGIN
  IF p_spit_amount <= 0 OR p_price_per_share <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amounts');
  END IF;

  v_remaining := p_spit_amount;

  FOR v_deposit IN
    SELECT id, principal, locked_rate, deposited_at, withdrawn
    FROM bank_deposits
    WHERE user_id = p_user_id AND currency = 'spit'
      AND withdrawn < principal + (principal * locked_rate * EXTRACT(EPOCH FROM (NOW() - deposited_at)) / 86400.0)
    ORDER BY deposited_at DESC
    FOR UPDATE
  LOOP
    v_interest := FLOOR(
      (v_deposit.principal * v_deposit.locked_rate *
       EXTRACT(EPOCH FROM (NOW() - v_deposit.deposited_at)) / 86400.0) * 100000
    ) / 100000;
    v_available := v_deposit.principal + v_interest - v_deposit.withdrawn;

    IF v_available <= 0 THEN
      DELETE FROM bank_deposits WHERE id = v_deposit.id;
      CONTINUE;
    END IF;

    v_take := LEAST(v_remaining, v_available);
    v_leftover := v_available - v_take;

    IF v_leftover < 0.01 THEN
      DELETE FROM bank_deposits WHERE id = v_deposit.id;
    ELSE
      UPDATE bank_deposits
      SET principal = v_leftover, withdrawn = 0, deposited_at = NOW()
      WHERE id = v_deposit.id;
    END IF;

    v_total_taken := v_total_taken + v_take;
    v_remaining := v_remaining - v_take;

    IF v_remaining <= 0 THEN EXIT; END IF;
  END LOOP;

  IF v_total_taken < p_spit_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient bank spit balance');
  END IF;

  v_shares := FLOOR((v_total_taken / p_price_per_share) * 100000) / 100000;

  INSERT INTO user_stock_holdings (user_id, shares, total_cost_basis)
  VALUES (p_user_id, v_shares, v_total_taken)
  ON CONFLICT (user_id) DO UPDATE
  SET shares = user_stock_holdings.shares + v_shares,
      total_cost_basis = user_stock_holdings.total_cost_basis + v_total_taken;

  SELECT shares INTO v_new_shares FROM user_stock_holdings WHERE user_id = p_user_id;

  INSERT INTO stock_transactions (user_id, type, shares, price_per_share, total_amount)
  VALUES (p_user_id, 'buy', v_shares, p_price_per_share, v_total_taken);

  RETURN jsonb_build_object(
    'success', true,
    'shares_bought', v_shares,
    'total_shares', v_new_shares,
    'spent', v_total_taken
  );
END;
$$;

-- 3. bank_buy_ticket
CREATE OR REPLACE FUNCTION bank_buy_ticket(
  p_user_id UUID,
  p_ticket_type TEXT,
  p_cost NUMERIC(20,5),
  p_currency TEXT,
  p_is_winner BOOLEAN,
  p_prize_amount NUMERIC(20,5)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining NUMERIC(20,5);
  v_deposit RECORD;
  v_interest NUMERIC(20,5);
  v_available NUMERIC(20,5);
  v_take NUMERIC(20,5);
  v_leftover NUMERIC(20,5);
  v_total_taken NUMERIC(20,5) := 0;
  v_ticket_id UUID;
BEGIN
  IF p_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid cost');
  END IF;

  v_remaining := p_cost;

  FOR v_deposit IN
    SELECT id, principal, locked_rate, deposited_at, withdrawn
    FROM bank_deposits
    WHERE user_id = p_user_id AND currency = p_currency
      AND withdrawn < principal + (principal * locked_rate * EXTRACT(EPOCH FROM (NOW() - deposited_at)) / 86400.0)
    ORDER BY deposited_at DESC
    FOR UPDATE
  LOOP
    v_interest := FLOOR(
      (v_deposit.principal * v_deposit.locked_rate *
       EXTRACT(EPOCH FROM (NOW() - v_deposit.deposited_at)) / 86400.0) * 100000
    ) / 100000;
    v_available := v_deposit.principal + v_interest - v_deposit.withdrawn;

    IF v_available <= 0 THEN
      DELETE FROM bank_deposits WHERE id = v_deposit.id;
      CONTINUE;
    END IF;

    v_take := LEAST(v_remaining, v_available);
    v_leftover := v_available - v_take;

    IF v_leftover < 0.01 THEN
      DELETE FROM bank_deposits WHERE id = v_deposit.id;
    ELSE
      UPDATE bank_deposits
      SET principal = v_leftover, withdrawn = 0, deposited_at = NOW()
      WHERE id = v_deposit.id;
    END IF;

    v_total_taken := v_total_taken + v_take;
    v_remaining := v_remaining - v_take;

    IF v_remaining <= 0 THEN EXIT; END IF;
  END LOOP;

  IF v_total_taken < p_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient bank balance');
  END IF;

  INSERT INTO lottery_tickets (user_id, ticket_type, cost_amount, cost_currency, is_winner, prize_amount, prize_currency)
  VALUES (p_user_id, p_ticket_type, p_cost, p_currency, p_is_winner, p_prize_amount, p_currency)
  RETURNING id INTO v_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id
  );
END;
$$;

-- Clean up any existing ghost deposits (withdrawn >= principal, negligible remaining)
DELETE FROM bank_deposits
WHERE principal + (principal * locked_rate * EXTRACT(EPOCH FROM (NOW() - deposited_at)) / 86400.0) - withdrawn < 0.01;

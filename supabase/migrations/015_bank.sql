-- ============================================
-- BANK SYSTEM: Deposits, Stocks, Lottery
-- ============================================

-- Bank Deposits (each deposit is a separate record with locked rate)
CREATE TABLE IF NOT EXISTS bank_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('spit', 'gold')),
  principal NUMERIC(20,5) NOT NULL CHECK (principal > 0),
  locked_rate NUMERIC(8,6) NOT NULL CHECK (locked_rate >= 0),
  deposited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn NUMERIC(20,5) NOT NULL DEFAULT 0 CHECK (withdrawn >= 0)
);

CREATE INDEX idx_bank_deposits_user ON bank_deposits(user_id);

-- Stock Holdings (one row per user)
CREATE TABLE IF NOT EXISTS user_stock_holdings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  shares NUMERIC(20,5) NOT NULL DEFAULT 0 CHECK (shares >= 0),
  total_cost_basis NUMERIC(20,5) NOT NULL DEFAULT 0 CHECK (total_cost_basis >= 0)
);

-- Stock Transactions (buy/sell history)
CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  shares NUMERIC(20,5) NOT NULL,
  price_per_share NUMERIC(20,5) NOT NULL,
  total_amount NUMERIC(20,5) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_transactions_user ON stock_transactions(user_id);

-- Lottery Tickets (pre-determined outcomes)
CREATE TABLE IF NOT EXISTS lottery_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_type TEXT NOT NULL,
  cost_amount NUMERIC(20,5) NOT NULL,
  cost_currency TEXT NOT NULL,
  is_winner BOOLEAN NOT NULL DEFAULT false,
  prize_amount NUMERIC(20,5) DEFAULT 0,
  prize_currency TEXT,
  scratched BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lottery_tickets_user ON lottery_tickets(user_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE bank_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stock_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deposits"
  ON bank_deposits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own stock holdings"
  ON user_stock_holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own stock transactions"
  ON stock_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own lottery tickets"
  ON lottery_tickets FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- RPC Functions
-- ============================================

-- 1. Bank Deposit: Deducts from main wallet, creates deposit record
CREATE OR REPLACE FUNCTION bank_deposit(
  p_user_id UUID,
  p_currency TEXT,
  p_amount INT,
  p_locked_rate NUMERIC(8,6)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_currency NOT IN ('spit', 'gold') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid currency');
  END IF;

  -- Lock and check balance
  IF p_currency = 'spit' THEN
    SELECT balance INTO v_current_balance
    FROM user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient spit balance');
    END IF;

    v_new_balance := v_current_balance - p_amount;
    UPDATE user_credits SET balance = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  ELSE
    SELECT balance INTO v_current_balance
    FROM user_gold
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient gold balance');
    END IF;

    v_new_balance := v_current_balance - p_amount;
    UPDATE user_gold SET balance = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;
  END IF;

  -- Create deposit record
  INSERT INTO bank_deposits (user_id, currency, principal, locked_rate)
  VALUES (p_user_id, p_currency, p_amount::NUMERIC, p_locked_rate);

  RETURN jsonb_build_object(
    'success', true,
    'new_wallet_balance', v_new_balance,
    'deposited', p_amount
  );
END;
$$;

-- 2. Bank Withdraw: LIFO withdrawal from deposits (interest first, then principal from newest)
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

  -- Iterate deposits LIFO (newest first), consuming interest then principal
  FOR v_deposit IN
    SELECT id, principal, locked_rate, deposited_at, withdrawn
    FROM bank_deposits
    WHERE user_id = p_user_id AND currency = p_currency
      AND withdrawn < principal + (principal * locked_rate / 365.0 * EXTRACT(EPOCH FROM (NOW() - deposited_at)) / 86400.0)
    ORDER BY deposited_at DESC
    FOR UPDATE
  LOOP
    -- Calculate total value (principal + accrued interest)
    v_interest := FLOOR(
      (v_deposit.principal * v_deposit.locked_rate / 365.0 *
       EXTRACT(EPOCH FROM (NOW() - v_deposit.deposited_at)) / 86400.0) * 100000
    ) / 100000;
    v_available := v_deposit.principal + v_interest - v_deposit.withdrawn;

    IF v_available <= 0 THEN
      CONTINUE;
    END IF;

    IF v_remaining <= v_available THEN
      v_take := v_remaining;
    ELSE
      v_take := v_available;
    END IF;

    UPDATE bank_deposits SET withdrawn = withdrawn + v_take WHERE id = v_deposit.id;
    v_total_withdrawn := v_total_withdrawn + v_take;
    v_remaining := v_remaining - v_take;

    IF v_remaining <= 0 THEN
      EXIT;
    END IF;
  END LOOP;

  IF v_total_withdrawn = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No funds available to withdraw');
  END IF;

  -- Credit wallet with FLOOR of withdrawn amount (integer)
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

-- 3. Buy Stock: LIFO withdrawal from spit deposits, upsert stock holdings
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
  v_total_taken NUMERIC(20,5) := 0;
  v_shares NUMERIC(20,5);
  v_new_shares NUMERIC(20,5);
BEGIN
  IF p_spit_amount <= 0 OR p_price_per_share <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amounts');
  END IF;

  v_remaining := p_spit_amount;

  -- LIFO withdrawal from spit deposits
  FOR v_deposit IN
    SELECT id, principal, locked_rate, deposited_at, withdrawn
    FROM bank_deposits
    WHERE user_id = p_user_id AND currency = 'spit'
      AND withdrawn < principal + (principal * locked_rate / 365.0 * EXTRACT(EPOCH FROM (NOW() - deposited_at)) / 86400.0)
    ORDER BY deposited_at DESC
    FOR UPDATE
  LOOP
    v_interest := FLOOR(
      (v_deposit.principal * v_deposit.locked_rate / 365.0 *
       EXTRACT(EPOCH FROM (NOW() - v_deposit.deposited_at)) / 86400.0) * 100000
    ) / 100000;
    v_available := v_deposit.principal + v_interest - v_deposit.withdrawn;

    IF v_available <= 0 THEN CONTINUE; END IF;

    v_take := LEAST(v_remaining, v_available);
    UPDATE bank_deposits SET withdrawn = withdrawn + v_take WHERE id = v_deposit.id;
    v_total_taken := v_total_taken + v_take;
    v_remaining := v_remaining - v_take;

    IF v_remaining <= 0 THEN EXIT; END IF;
  END LOOP;

  IF v_total_taken < p_spit_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient bank spit balance');
  END IF;

  v_shares := FLOOR((v_total_taken / p_price_per_share) * 100000) / 100000;

  -- Upsert stock holdings
  INSERT INTO user_stock_holdings (user_id, shares, total_cost_basis)
  VALUES (p_user_id, v_shares, v_total_taken)
  ON CONFLICT (user_id) DO UPDATE
  SET shares = user_stock_holdings.shares + v_shares,
      total_cost_basis = user_stock_holdings.total_cost_basis + v_total_taken;

  SELECT shares INTO v_new_shares FROM user_stock_holdings WHERE user_id = p_user_id;

  -- Log transaction
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

-- 4. Sell Stock: Reduce holdings, create 0% deposit with proceeds
CREATE OR REPLACE FUNCTION bank_sell_stock(
  p_user_id UUID,
  p_shares NUMERIC(20,5),
  p_price_per_share NUMERIC(20,5)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_shares NUMERIC(20,5);
  v_cost_basis NUMERIC(20,5);
  v_proceeds NUMERIC(20,5);
  v_avg_cost NUMERIC(20,5);
  v_cost_reduction NUMERIC(20,5);
BEGIN
  IF p_shares <= 0 OR p_price_per_share <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amounts');
  END IF;

  SELECT shares, total_cost_basis INTO v_current_shares, v_cost_basis
  FROM user_stock_holdings
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_shares IS NULL OR v_current_shares < p_shares THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient shares');
  END IF;

  v_proceeds := FLOOR((p_shares * p_price_per_share) * 100000) / 100000;

  -- Reduce cost basis proportionally
  IF v_current_shares > 0 THEN
    v_avg_cost := v_cost_basis / v_current_shares;
    v_cost_reduction := v_avg_cost * p_shares;
  ELSE
    v_cost_reduction := 0;
  END IF;

  UPDATE user_stock_holdings
  SET shares = shares - p_shares,
      total_cost_basis = GREATEST(0, total_cost_basis - v_cost_reduction)
  WHERE user_id = p_user_id;

  -- Create 0% interest deposit with proceeds (funds sit in bank)
  INSERT INTO bank_deposits (user_id, currency, principal, locked_rate)
  VALUES (p_user_id, 'spit', v_proceeds, 0);

  -- Log transaction
  INSERT INTO stock_transactions (user_id, type, shares, price_per_share, total_amount)
  VALUES (p_user_id, 'sell', p_shares, p_price_per_share, v_proceeds);

  RETURN jsonb_build_object(
    'success', true,
    'shares_sold', p_shares,
    'proceeds', v_proceeds,
    'remaining_shares', v_current_shares - p_shares,
    'cost_basis_sold', v_cost_reduction,
    'profit', v_proceeds - v_cost_reduction
  );
END;
$$;

-- 5. Buy Lottery Ticket: LIFO withdrawal from deposits, insert ticket
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
  v_total_taken NUMERIC(20,5) := 0;
  v_ticket_id UUID;
BEGIN
  IF p_cost <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid cost');
  END IF;

  v_remaining := p_cost;

  -- LIFO withdrawal from deposits of the given currency
  FOR v_deposit IN
    SELECT id, principal, locked_rate, deposited_at, withdrawn
    FROM bank_deposits
    WHERE user_id = p_user_id AND currency = p_currency
      AND withdrawn < principal + (principal * locked_rate / 365.0 * EXTRACT(EPOCH FROM (NOW() - deposited_at)) / 86400.0)
    ORDER BY deposited_at DESC
    FOR UPDATE
  LOOP
    v_interest := FLOOR(
      (v_deposit.principal * v_deposit.locked_rate / 365.0 *
       EXTRACT(EPOCH FROM (NOW() - v_deposit.deposited_at)) / 86400.0) * 100000
    ) / 100000;
    v_available := v_deposit.principal + v_interest - v_deposit.withdrawn;

    IF v_available <= 0 THEN CONTINUE; END IF;

    v_take := LEAST(v_remaining, v_available);
    UPDATE bank_deposits SET withdrawn = withdrawn + v_take WHERE id = v_deposit.id;
    v_total_taken := v_total_taken + v_take;
    v_remaining := v_remaining - v_take;

    IF v_remaining <= 0 THEN EXIT; END IF;
  END LOOP;

  IF v_total_taken < p_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient bank balance');
  END IF;

  -- Insert ticket
  INSERT INTO lottery_tickets (user_id, ticket_type, cost_amount, cost_currency, is_winner, prize_amount, prize_currency)
  VALUES (p_user_id, p_ticket_type, p_cost, p_currency, p_is_winner, p_prize_amount, p_currency)
  RETURNING id INTO v_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id
  );
END;
$$;

-- 6. Scratch Ticket: Reveal outcome, if winner create 0% deposit
CREATE OR REPLACE FUNCTION bank_scratch_ticket(
  p_user_id UUID,
  p_ticket_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  SELECT * INTO v_ticket
  FROM lottery_tickets
  WHERE id = p_ticket_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_ticket IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.scratched THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already scratched');
  END IF;

  -- Mark as scratched
  UPDATE lottery_tickets SET scratched = true WHERE id = p_ticket_id;

  -- If winner, create 0% deposit with prize
  IF v_ticket.is_winner AND v_ticket.prize_amount > 0 THEN
    INSERT INTO bank_deposits (user_id, currency, principal, locked_rate)
    VALUES (p_user_id, v_ticket.prize_currency, v_ticket.prize_amount, 0);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_winner', v_ticket.is_winner,
    'prize_amount', COALESCE(v_ticket.prize_amount, 0),
    'prize_currency', v_ticket.prize_currency
  );
END;
$$;

-- SPITr Credit Card System
-- Gold-denominated credit line with credit score, billing cycles, and ATM cash advances

CREATE TABLE IF NOT EXISTS user_credit_cards (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  credit_limit INT NOT NULL DEFAULT 1000,
  current_balance INT NOT NULL DEFAULT 0,
  credit_score INT NOT NULL DEFAULT 500,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  billing_cycle_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_payment_at TIMESTAMPTZ,
  consecutive_on_time INT NOT NULL DEFAULT 0,
  missed_payments INT NOT NULL DEFAULT 0,
  total_spent INT NOT NULL DEFAULT 0,
  total_paid INT NOT NULL DEFAULT 0,
  last_limit_increase_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT positive_balance CHECK (current_balance >= 0),
  CONSTRAINT valid_credit_limit CHECK (credit_limit >= 500 AND credit_limit <= 50000),
  CONSTRAINT valid_credit_score CHECK (credit_score >= 100 AND credit_score <= 850)
);

CREATE TABLE IF NOT EXISTS credit_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'cash_advance', 'payment', 'interest', 'late_fee', 'reward')),
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cc_transactions_user ON credit_card_transactions(user_id);

ALTER TABLE user_credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit card"
  ON user_credit_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own cc transactions"
  ON credit_card_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Activate credit card (user accepts offer)
CREATE OR REPLACE FUNCTION activate_credit_card(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM user_credit_cards WHERE user_id = p_user_id) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credit card already activated');
  END IF;

  INSERT INTO user_credit_cards (user_id, credit_limit, current_balance, credit_score)
  VALUES (p_user_id, 1000, 0, 500);

  RETURN jsonb_build_object('success', true, 'credit_limit', 1000, 'credit_score', 500);
END;
$$;

-- Purchase on credit card
CREATE OR REPLACE FUNCTION credit_card_purchase(
  p_user_id UUID,
  p_amount INT,
  p_description TEXT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_card RECORD;
  v_new_balance INT;
  v_available INT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT * INTO v_card FROM user_credit_cards WHERE user_id = p_user_id FOR UPDATE;
  IF v_card IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit card activated');
  END IF;

  v_available := v_card.credit_limit - v_card.current_balance;
  IF p_amount > v_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credit. Available: ' || v_available);
  END IF;

  v_new_balance := v_card.current_balance + p_amount;

  UPDATE user_credit_cards
  SET current_balance = v_new_balance, total_spent = total_spent + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO credit_card_transactions (user_id, type, amount, balance_after, description, reference_id)
  VALUES (p_user_id, 'purchase', p_amount, v_new_balance, p_description, p_reference_id);

  RETURN jsonb_build_object(
    'success', true,
    'charged', p_amount,
    'new_balance', v_new_balance,
    'available_credit', v_card.credit_limit - v_new_balance
  );
END;
$$;

-- ATM cash advance: withdraw credit as gold into wallet (no fee)
CREATE OR REPLACE FUNCTION credit_card_cash_advance(
  p_user_id UUID,
  p_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_card RECORD;
  v_new_cc_balance INT;
  v_new_gold INT;
  v_available INT;
  v_new_score INT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_amount < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum advance is 10 gold');
  END IF;

  SELECT * INTO v_card FROM user_credit_cards WHERE user_id = p_user_id FOR UPDATE;
  IF v_card IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit card activated');
  END IF;

  v_available := v_card.credit_limit - v_card.current_balance;
  IF p_amount > v_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credit for advance');
  END IF;

  v_new_cc_balance := v_card.current_balance + p_amount;
  v_new_score := GREATEST(100, v_card.credit_score - 2);

  -- Charge credit card
  UPDATE user_credit_cards
  SET current_balance = v_new_cc_balance,
      credit_score = v_new_score,
      total_spent = total_spent + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Add gold to wallet
  UPDATE user_gold
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_gold;

  -- If no gold row, create one
  IF v_new_gold IS NULL THEN
    INSERT INTO user_gold (user_id, balance) VALUES (p_user_id, p_amount)
    RETURNING balance INTO v_new_gold;
  END IF;

  -- Log credit card transaction
  INSERT INTO credit_card_transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'cash_advance', p_amount, v_new_cc_balance,
          'Cash advance: ' || p_amount || ' gold');

  -- Log gold transaction
  INSERT INTO gold_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (p_user_id, 'purchase', p_amount, v_new_gold, 'credit_card_advance');

  RETURN jsonb_build_object(
    'success', true,
    'gold_received', p_amount,
    'new_cc_balance', v_new_cc_balance,
    'new_gold_balance', v_new_gold,
    'new_credit_score', v_new_score
  );
END;
$$;

-- Pay down credit card balance from gold wallet
CREATE OR REPLACE FUNCTION credit_card_payment(
  p_user_id UUID,
  p_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_card RECORD;
  v_gold INT;
  v_pay_amount INT;
  v_new_cc_balance INT;
  v_new_gold INT;
  v_score_bonus INT := 0;
  v_new_score INT;
  v_days_in_cycle NUMERIC;
  v_on_time BOOLEAN;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT * INTO v_card FROM user_credit_cards WHERE user_id = p_user_id FOR UPDATE;
  IF v_card IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit card activated');
  END IF;

  SELECT balance INTO v_gold FROM user_gold WHERE user_id = p_user_id FOR UPDATE;
  IF v_gold IS NULL OR v_gold < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient gold');
  END IF;

  v_pay_amount := LEAST(p_amount, v_card.current_balance);
  IF v_pay_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No balance to pay');
  END IF;

  v_new_cc_balance := v_card.current_balance - v_pay_amount;

  v_days_in_cycle := EXTRACT(EPOCH FROM (NOW() - v_card.billing_cycle_start)) / 86400;
  v_on_time := v_days_in_cycle <= 7;

  -- Credit score boost
  IF v_pay_amount >= v_card.current_balance THEN
    v_score_bonus := 15;  -- full payoff
  ELSE
    v_score_bonus := 5;   -- partial payment
  END IF;
  IF v_on_time THEN
    v_score_bonus := v_score_bonus + 5;
  END IF;
  -- Streak bonus
  v_score_bonus := v_score_bonus + LEAST(10, v_card.consecutive_on_time * 2);

  v_new_score := LEAST(850, v_card.credit_score + v_score_bonus);

  UPDATE user_credit_cards
  SET current_balance = v_new_cc_balance,
      credit_score = v_new_score,
      total_paid = total_paid + v_pay_amount,
      last_payment_at = NOW(),
      consecutive_on_time = CASE WHEN v_on_time THEN consecutive_on_time + 1 ELSE 0 END,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  v_new_gold := v_gold - v_pay_amount;
  UPDATE user_gold SET balance = v_new_gold, updated_at = NOW() WHERE user_id = p_user_id;

  INSERT INTO credit_card_transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'payment', -v_pay_amount, v_new_cc_balance,
          'Payment of ' || v_pay_amount || ' gold');

  INSERT INTO gold_transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (p_user_id, 'item_purchase', -v_pay_amount, v_new_gold, 'credit_card_payment');

  RETURN jsonb_build_object(
    'success', true,
    'paid', v_pay_amount,
    'new_cc_balance', v_new_cc_balance,
    'new_gold_balance', v_new_gold,
    'score_bonus', v_score_bonus,
    'new_credit_score', v_new_score,
    'on_time', v_on_time
  );
END;
$$;

-- Process billing cycle (lazy, called on access)
CREATE OR REPLACE FUNCTION process_billing_cycle(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_card RECORD;
  v_days_since_cycle NUMERIC;
  v_interest INT;
  v_late_fee INT := 0;
  v_new_balance INT;
  v_new_score INT;
  v_score_penalty INT := 0;
  v_new_limit INT;
BEGIN
  SELECT * INTO v_card FROM user_credit_cards WHERE user_id = p_user_id FOR UPDATE;
  IF v_card IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No card');
  END IF;

  v_days_since_cycle := EXTRACT(EPOCH FROM (NOW() - v_card.billing_cycle_start)) / 86400;

  IF v_days_since_cycle < 7 THEN
    RETURN jsonb_build_object('processed', false);
  END IF;

  v_new_balance := v_card.current_balance;
  v_interest := 0;

  -- 5% interest on outstanding balance
  IF v_card.current_balance > 0 THEN
    v_interest := GREATEST(1, FLOOR(v_card.current_balance * 0.05));
    v_new_balance := v_new_balance + v_interest;

    INSERT INTO credit_card_transactions (user_id, type, amount, balance_after, description)
    VALUES (p_user_id, 'interest', v_interest, v_new_balance,
            '5% interest on ' || v_card.current_balance || 'g balance');

    -- Check for missed payment
    IF v_card.last_payment_at IS NULL OR v_card.last_payment_at < v_card.billing_cycle_start THEN
      v_late_fee := GREATEST(5, FLOOR(v_card.current_balance * 0.03));
      v_new_balance := v_new_balance + v_late_fee;
      v_score_penalty := 25;

      INSERT INTO credit_card_transactions (user_id, type, amount, balance_after, description)
      VALUES (p_user_id, 'late_fee', v_late_fee, v_new_balance, 'Late payment fee');
    END IF;
  END IF;

  v_new_score := GREATEST(100, v_card.credit_score - v_score_penalty);

  -- Credit limit: no auto-increase during billing cycle
  -- Users apply manually via credit_card_request_increase
  v_new_limit := v_card.credit_limit;

  UPDATE user_credit_cards
  SET current_balance = v_new_balance,
      credit_score = v_new_score,
      credit_limit = v_new_limit,
      billing_cycle_start = NOW(),
      missed_payments = missed_payments + CASE WHEN v_score_penalty > 0 THEN 1 ELSE 0 END,
      consecutive_on_time = CASE WHEN v_score_penalty > 0 THEN 0 ELSE consecutive_on_time END,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'processed', true,
    'interest_charged', v_interest,
    'late_fee', v_late_fee,
    'new_balance', v_new_balance,
    'new_score', v_new_score,
    'new_limit', v_new_limit,
    'limit_increased', v_new_limit > v_card.credit_limit
  );
END;
$$;

-- Request credit limit increase (doubles limit, once per 7 days, capped by score tier)
CREATE OR REPLACE FUNCTION credit_card_request_increase(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_card RECORD;
  v_days_since_increase NUMERIC;
  v_tier_cap INT;
  v_new_limit INT;
BEGIN
  SELECT * INTO v_card FROM user_credit_cards WHERE user_id = p_user_id FOR UPDATE;
  IF v_card IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit card activated');
  END IF;

  -- Check cooldown (7 days)
  IF v_card.last_limit_increase_at IS NOT NULL THEN
    v_days_since_increase := EXTRACT(EPOCH FROM (NOW() - v_card.last_limit_increase_at)) / 86400;
    IF v_days_since_increase < 7 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Can only request increase once per week',
        'days_remaining', CEIL(7 - v_days_since_increase));
    END IF;
  END IF;

  -- Determine tier cap based on credit score
  IF v_card.credit_score >= 800 THEN v_tier_cap := 50000;
  ELSIF v_card.credit_score >= 700 THEN v_tier_cap := 25000;
  ELSIF v_card.credit_score >= 600 THEN v_tier_cap := 10000;
  ELSIF v_card.credit_score >= 500 THEN v_tier_cap := 5000;
  ELSIF v_card.credit_score >= 300 THEN v_tier_cap := 2000;
  ELSE v_tier_cap := 500;
  END IF;

  IF v_card.credit_limit >= v_tier_cap THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already at max limit for your credit tier. Improve your score to unlock higher limits.');
  END IF;

  -- Double the limit, capped by tier
  v_new_limit := LEAST(v_tier_cap, v_card.credit_limit * 2);

  UPDATE user_credit_cards
  SET credit_limit = v_new_limit, last_limit_increase_at = NOW(), updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'old_limit', v_card.credit_limit,
    'new_limit', v_new_limit,
    'tier_cap', v_tier_cap
  );
END;
$$;

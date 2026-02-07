-- Certificate of Deposits (CDs): fixed-term deposits with guaranteed returns
-- 7-day CD: 10% return on principal
-- 30-day CD: 20% return on principal

CREATE TABLE IF NOT EXISTS bank_cds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('spit', 'gold')),
  principal NUMERIC(20,5) NOT NULL CHECK (principal > 0),
  rate NUMERIC(8,6) NOT NULL CHECK (rate > 0),
  term_days INT NOT NULL CHECK (term_days > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matures_at TIMESTAMPTZ NOT NULL,
  redeemed BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_bank_cds_user ON bank_cds(user_id);

ALTER TABLE bank_cds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own CDs"
  ON bank_cds FOR SELECT
  USING (auth.uid() = user_id);

-- Buy CD: deducts from wallet, creates locked CD
CREATE OR REPLACE FUNCTION bank_buy_cd(
  p_user_id UUID,
  p_currency TEXT,
  p_amount INT,
  p_term_days INT,
  p_rate NUMERIC(8,6)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
  v_cd_id UUID;
  v_matures_at TIMESTAMPTZ;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF p_currency NOT IN ('spit', 'gold') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid currency');
  END IF;

  IF p_term_days NOT IN (7, 30) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid term');
  END IF;

  v_matures_at := NOW() + (p_term_days || ' days')::INTERVAL;

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

  -- Create CD
  INSERT INTO bank_cds (user_id, currency, principal, rate, term_days, matures_at)
  VALUES (p_user_id, p_currency, p_amount::NUMERIC, p_rate, p_term_days, v_matures_at)
  RETURNING id INTO v_cd_id;

  RETURN jsonb_build_object(
    'success', true,
    'cd_id', v_cd_id,
    'matures_at', v_matures_at,
    'new_wallet_balance', v_new_balance
  );
END;
$$;

-- Redeem CD: if matured, credits wallet with principal + bonus
CREATE OR REPLACE FUNCTION bank_redeem_cd(
  p_user_id UUID,
  p_cd_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cd RECORD;
  v_bonus NUMERIC(20,5);
  v_payout INT;
  v_new_wallet INT;
BEGIN
  SELECT * INTO v_cd
  FROM bank_cds
  WHERE id = p_cd_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_cd IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'CD not found');
  END IF;

  IF v_cd.redeemed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already redeemed');
  END IF;

  IF NOW() < v_cd.matures_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'CD has not matured yet');
  END IF;

  -- Calculate payout: principal + (principal * rate), floored to integer
  v_bonus := v_cd.principal * v_cd.rate;
  v_payout := FLOOR(v_cd.principal + v_bonus)::INT;

  -- Mark as redeemed
  UPDATE bank_cds SET redeemed = true WHERE id = p_cd_id;

  -- Credit wallet
  IF v_cd.currency = 'spit' THEN
    UPDATE user_credits
    SET balance = balance + v_payout, updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_wallet;
  ELSE
    UPDATE user_gold
    SET balance = balance + v_payout, updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_wallet;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'principal', v_cd.principal,
    'bonus', FLOOR(v_bonus),
    'payout', v_payout,
    'new_wallet_balance', v_new_wallet
  );
END;
$$;

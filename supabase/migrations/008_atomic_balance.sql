-- Atomic balance increment function to avoid TOCTOU race conditions
-- Used by payment confirmation routes and webhook
CREATE OR REPLACE FUNCTION increment_balance(
  table_name TEXT,
  user_id_param UUID,
  amount_param INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  IF table_name = 'user_credits' THEN
    UPDATE user_credits
    SET balance = balance + amount_param, updated_at = NOW()
    WHERE user_id = user_id_param
    RETURNING balance INTO new_balance;

    IF NOT FOUND THEN
      INSERT INTO user_credits (user_id, balance)
      VALUES (user_id_param, amount_param)
      RETURNING balance INTO new_balance;
    END IF;
  ELSIF table_name = 'user_gold' THEN
    UPDATE user_gold
    SET balance = balance + amount_param, updated_at = NOW()
    WHERE user_id = user_id_param
    RETURNING balance INTO new_balance;

    IF NOT FOUND THEN
      INSERT INTO user_gold (user_id, balance)
      VALUES (user_id_param, amount_param)
      RETURNING balance INTO new_balance;
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid table_name: %', table_name;
  END IF;

  RETURN new_balance;
END;
$$;

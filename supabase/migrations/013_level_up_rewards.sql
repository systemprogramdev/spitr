-- 013: Level-up rewards (1 chest, 100 spits, 10 gold, HP increase)
-- Also updates use_potion to use dynamic max HP based on level

-- Replace award_xp to grant rewards on level-up
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
  v_new_max_hp INT;
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

    -- Calculate new max HP: 5000 + (level - 1) * 100
    v_new_max_hp := 5000 + (v_new_level - 1) * 100;

    -- Increase user HP to new max (full heal on level up)
    UPDATE users SET hp = v_new_max_hp, is_destroyed = FALSE WHERE id = p_user_id;

    -- Award 100 spits
    INSERT INTO user_credits (user_id, balance)
    VALUES (p_user_id, 100)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = user_credits.balance + 100;

    -- Log the spit reward
    INSERT INTO credit_transactions (user_id, amount, type, balance_after, reference_id)
    SELECT p_user_id, 100, 'level_up',
      (SELECT balance FROM user_credits WHERE user_id = p_user_id),
      NULL;

    -- Award 10 gold
    INSERT INTO user_gold (user_id, balance)
    VALUES (p_user_id, 10)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = user_gold.balance + 10;

    -- Log the gold reward
    INSERT INTO gold_transactions (user_id, amount, type, balance_after)
    SELECT p_user_id, 10, 'level_up',
      (SELECT balance FROM user_gold WHERE user_id = p_user_id);

    -- Award 1 treasure chest
    INSERT INTO user_chests (user_id, claimed_at, opened)
    VALUES (p_user_id, NOW(), FALSE);
  END IF;

  -- Log XP transaction
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

-- Update use_potion to use dynamic max HP based on level
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
  v_user_level INT;
  v_max_hp INT;
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

  -- Get user level for dynamic max HP
  SELECT COALESCE(level, 1) INTO v_user_level FROM user_xp WHERE user_id = p_user_id;
  IF v_user_level IS NULL THEN
    v_user_level := 1;
  END IF;

  -- Dynamic max HP: 5000 + (level - 1) * 100
  v_max_hp := 5000 + (v_user_level - 1) * 100;

  -- Calculate new HP (cap at dynamic max)
  v_new_hp := LEAST(v_max_hp, v_current_hp + p_heal_amount);

  -- Deduct item
  UPDATE user_inventory
  SET quantity = quantity - 1
  WHERE user_id = p_user_id AND item_type = p_item_type;

  -- Clean up zero-quantity rows
  DELETE FROM user_inventory
  WHERE user_id = p_user_id AND item_type = p_item_type AND quantity <= 0;

  -- Apply healing
  UPDATE users
  SET hp = v_new_hp
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_hp', v_new_hp,
    'healed', v_new_hp - v_current_hp,
    'max_hp', v_max_hp
  );
END;
$$;

-- Revive a destroyed bot using a potion from the owner's inventory
-- Owner spends their own potion to bring a bot back to life
CREATE OR REPLACE FUNCTION revive_bot(
  p_owner_id UUID,
  p_bot_user_id UUID,
  p_item_type item_type,
  p_heal_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot_owner_id UUID;
  v_bot_hp INT;
  v_bot_destroyed BOOLEAN;
  v_owner_qty INT;
  v_bot_level INT;
  v_max_hp INT;
  v_new_hp INT;
BEGIN
  -- Verify the caller owns this bot
  SELECT owner_id INTO v_bot_owner_id
  FROM bots
  WHERE user_id = p_bot_user_id;

  IF v_bot_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bot not found');
  END IF;

  IF v_bot_owner_id != p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not own this bot');
  END IF;

  -- Check the bot is actually destroyed
  SELECT hp, is_destroyed INTO v_bot_hp, v_bot_destroyed
  FROM users
  WHERE id = p_bot_user_id;

  IF v_bot_hp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bot user not found');
  END IF;

  -- Allow revive if is_destroyed OR hp = 0 (transfer penalty can zero HP without setting is_destroyed)
  IF NOT v_bot_destroyed AND v_bot_hp > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bot is not destroyed');
  END IF;

  -- Check owner has the potion in their inventory
  SELECT quantity INTO v_owner_qty
  FROM user_inventory
  WHERE user_id = p_owner_id AND item_type = p_item_type;

  IF v_owner_qty IS NULL OR v_owner_qty < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have this potion');
  END IF;

  -- Get bot level for dynamic max HP
  SELECT COALESCE(level, 1) INTO v_bot_level FROM user_xp WHERE user_id = p_bot_user_id;
  IF v_bot_level IS NULL THEN
    v_bot_level := 1;
  END IF;

  v_max_hp := 5000 + (v_bot_level - 1) * 100;
  v_new_hp := LEAST(v_max_hp, p_heal_amount);

  -- Deduct potion from owner's inventory
  UPDATE user_inventory
  SET quantity = quantity - 1
  WHERE user_id = p_owner_id AND item_type = p_item_type;

  DELETE FROM user_inventory
  WHERE user_id = p_owner_id AND item_type = p_item_type AND quantity <= 0;

  -- Revive the bot
  UPDATE users
  SET hp = v_new_hp, is_destroyed = false
  WHERE id = p_bot_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_hp', v_new_hp,
    'max_hp', v_max_hp,
    'potion_used', p_item_type
  );
END;
$$;

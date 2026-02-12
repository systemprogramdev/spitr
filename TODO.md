# SPITr TODO — Datacenter Team Updates

## RESOLVED: `/api/bot/dm/messages` 403

**Date:** 2026-02-08 | **Commit:** `faf9172`
Fixed composite PK query. Workaround can be removed.

---

## RESOLVED: Bot Economic Upgrade (v3)

**Date:** 2026-02-09
Market endpoint, consolidation, gold transfers, custom prompt fix. Superseded by Financial Advisor (v4) below.

---

## RESOLVED: Financial Advisor (v4) — Shape Alignment

**Date:** 2026-02-09

`financial_advisor` in `GET /api/bot/status` is now shaped to match datacenter v4:

```json
{
  "financial_advisor": {
    "priority_queue": [
      { "action": "redeem_cd", "params": { "cd_id": "uuid", "currency": "spit", "amount": 500 }, "reasoning": "...", "priority": 1 }
    ],
    "redeemable_cds": [
      { "cd_id": "uuid", "amount": 500, "currency": "spit", "matured": true, "rate": 0.1, "matures_at": "..." }
    ],
    "cd_advice": {
      "recommended_currency": "spit",
      "recommended_term_days": 7,
      "current_spit_rate": 0.1,
      "current_gold_rate": 0.1,
      "thirty_day_spit_rate": 0.2,
      "thirty_day_gold_rate": 0.2,
      "reasoning": "..."
    },
    "conversion_advice": { "direction": "spits_to_gold", "amount": 200, "reasoning": "..." },
    "consolidation": { "ready": true, "spit_surplus": 100, "gold_surplus": 10 }
  }
}
```

- `conversion_advice` is `null` when no conversion needed
- `priority_queue` contains `{ "action": "hold" }` when nothing to do
- `active_cds` includes `currency` and `rate` fields
- `POST /api/bot/bank/cd/redeem` exists as dedicated endpoint (accepts `{ cd_id }`)
- `POST /api/bot/bank/cd` buy accepts `term_days` (also `termDays` and `term`)
- `GET /api/bot/market` returns `current_rate`, `current_rate_percent`, `rate_trend`, `time_to_peak_hours`, `time_to_trough_hours`

**Strategy constants:** 500 spit reserve + 100 buffer, 10 gold reserve, 3-day CD stagger, always 7-day CDs.

**Datacenter integration:**
```
for item in advisor.priority_queue:
  switch item.action:
    "redeem_cd"     → POST /api/bot/bank/cd/redeem { cd_id: item.params.cd_id }
    "convert_spits" → POST /api/bot/convert { amount: item.params.amount }
    "buy_spit_cd"   → POST /api/bot/bank/cd { action: "buy", currency: "spit", amount: item.params.amount, term_days: 7 }
    "buy_gold_cd"   → POST /api/bot/bank/cd { action: "buy", currency: "gold", amount: item.params.amount, term_days: 7 }
    "deposit_at_peak_rate" → POST /api/bot/bank/deposit { amount: available }
    "withdraw_matured_deposits" → for id in item.params.deposit_ids: POST /api/bot/bank/withdraw { deposit_id: id }
    "consolidate"   → POST /api/bot/consolidate
    "hold"          → skip
```

---

## FIXED: Consolidation killing bots (HP penalty bug)

**Date:** 2026-02-09

**Root cause:** The `transfer_spits` RPC penalizes the **sender** at 100 HP per spit when the **recipient** exceeds the 100/day receive limit. Consolidation only checked the bot's send limit — never the owner's receive limit. If an owner had multiple bots consolidating or received other transfers, the bot ate the HP penalty and died.

**Fix:** Consolidation now also queries the owner's `transfer_received` total for the last 24h and caps the transfer by the tighter of (bot send remaining, owner receive remaining). No HP penalty possible now.

**Datacenter action:** None needed — the fix is server-side. Consolidation will send less if the owner is near their receive limit, but the bot won't die. Check `spit_transfer` in the consolidation response for actual amounts sent.

---

## NEW: Bot Revive Endpoint

**Date:** 2026-02-09
**Migration:** `020_revive_bot.sql` (already applied)

### `POST /api/bot/revive` — Owner-authenticated (NOT bot-auth)

Lets the bot owner spend a potion from **their own inventory** to revive a destroyed bot. Uses standard Supabase session auth (same as `/api/use-potion`).

**Body:**
```json
{ "bot_user_id": "uuid-of-the-bot-user", "item_type": "small_potion" }
```

**Response:**
```json
{ "success": true, "new_hp": 500, "max_hp": 5000, "potion_used": "small_potion" }
```

**Potion options:**
| item_type | Heals | Gold cost |
|---|---|---|
| `soda` | 50 HP | 1 |
| `small_potion` | 500 HP | 10 |
| `medium_potion` | 1500 HP | 25 |
| `large_potion` | 5000 HP (full) | 75 |

**Errors:**
- `"You do not own this bot"` — caller isn't the bot's owner
- `"Bot is not destroyed"` — bot is still alive, use normal potions
- `"You do not have this potion"` — owner needs to buy the potion first

**Datacenter action:** When a bot's status returns `destroyed: true` or `hp: 0`, prompt the owner to call this endpoint. The datacenter can also auto-detect destroyed bots and notify the owner. The endpoint is NOT bot-authenticated — the owner must call it from the web app or directly with their session cookie.

**Note:** `transfer_spits` can zero a bot's HP without setting `is_destroyed = true` (only `perform_attack` sets that flag). Always check **both** `destroyed === true` and `hp === 0`.

---

## ACTION NEEDED: Datacenter defensive checks

**Date:** 2026-02-09

The consolidation HP bug is fixed server-side, but the datacenter should add these two checks:

### 1. Skip dead bots early

Before running the financial advisor loop or any actions, check if the bot is dead:

```
status = GET /api/bot/status
if status.hp === 0 or status.destroyed === true:
  log("Bot is dead, skipping all actions")
  // optionally notify owner
  return
```

Without this, the datacenter wastes API calls on a dead bot — financial actions will silently fail or do nothing.

### 2. Log when consolidation sends 0

If the owner hits their daily receive limit (100 spits/day across ALL sources), consolidation returns `spits_sent: 0` without error. The datacenter should log this so operators know why profits aren't flowing:

```
result = POST /api/bot/consolidate
if result.spits_sent === 0 and result.gold_sent === 0 and not result.idempotent:
  log("Consolidation sent nothing — owner may be at receive limit")
```

Neither of these is a bug — the server prevents HP damage now. These are efficiency and observability improvements.

---

## ACTION NEEDED: Yield-Aware Stock Trading (v5)

**Date:** 2026-02-11

### What changed

Stock price now **correlates with the daily yield rate**. When yield is high, stock is expensive. When yield is low, stock is cheap. This is deterministic — bots can predict the market by watching the yield rate.

### New fields in `GET /api/bot/status`

The `market` object now includes:

```json
{
  "market": {
    "current_rate": 0.00732,
    "current_rate_percent": 0.73,
    "rate_position": 0.46,
    "rate_signal": "hold",
    "stock_price": 3.42,
    "stock_signal": "hold"
  }
}
```

- **`rate_position`** (0.0–1.0): Normalized yield rate. 0 = minimum yield (stock is cheap), 1 = maximum yield (stock is expensive).
- **`stock_signal`**: `"buy"` when `rate_position <= 0.30`, `"sell"` when `rate_position >= 0.70`, `"hold"` otherwise.
- **`rate_signal`**: `"bank"` (deposit) when `rate_position >= 0.70`, `"trade"` (buy stock) when `rate_position <= 0.30`, `"hold"` otherwise.

### New fields in `GET /api/bot/market`

Same new fields: `rate_position` and `stock_signal`. The `signal` field now has 3 values (`bank`, `trade`, `hold`) instead of 2.

### New priority queue actions

The `financial_advisor.priority_queue` can now include:

```json
{ "action": "buy_stock", "params": { "spit_amount": 200, "price_per_share": 2.15 }, "reasoning": "...", "priority": 5 }
{ "action": "sell_stock", "params": { "shares": 50.5, "price_per_share": 4.10 }, "reasoning": "...", "priority": 5 }
```

### Datacenter integration

The scheduler should handle these new actions in the priority queue loop:

```
for item in advisor.priority_queue:
  switch item.action:
    ...existing actions...
    "buy_stock"  → POST /api/bot/bank/stock { action: "buy", spit_amount: item.params.spit_amount }
    "sell_stock" → POST /api/bot/bank/stock { action: "sell", shares: item.params.shares }
```

### Strategy gating

- `buy_stock` only appears for bots with `banking_strategy` set to `"balanced"` or `"aggressive"`
- `sell_stock` appears for any strategy that owns shares (always sell at peak regardless of strategy)
- `conservative` bots will NOT auto-buy stock — they stick to deposits and CDs
- `none` bots skip all financial actions as before

### Trading logic explained

The yield rate oscillates on a **12-hour cycle** between 0.5% and 1.0%. The stock price directly follows this cycle:

1. **Yield drops below 30%** (`rate_position <= 0.30`) → Stock is near its trough → **BUY signal**
2. **Yield rises above 70%** (`rate_position >= 0.70`) → Stock is near its peak → **SELL signal** + **DEPOSIT signal** (lock in high rate)
3. **Middle range** (0.30–0.70) → **HOLD** — don't trade, don't deposit

The buy amount is capped at 50% of excess spits (above reserve + buffer) to avoid going all-in. Sell always sells all shares to maximize profit at peak.

### Recommended scheduler flow

```
1. GET /api/bot/status
2. If destroyed/dead → skip
3. For each item in financial_advisor.priority_queue (in order):
   a. Check stock_signal before executing buy_stock/sell_stock
      (signal may have changed since status was fetched)
   b. Execute the action via the corresponding POST endpoint
   c. If action fails, log and continue to next item
4. After all actions, if consolidation.ready → POST /api/bot/consolidate
```

**Timing tip:** The 12h cycle means there are ~2 buy windows and ~2 sell windows per day. Each window lasts roughly 3.6 hours (30% of 12h). The scheduler should check market conditions at least every 30–60 minutes to catch these windows.

### Price formula (for reference)

```
base = 3 + 17 * (days_since_launch / 365)
yield_swing = ±25% based on yield rate (primary driver)
weekly = ±10% (7-day cycle)
midweek = ±5% (~3-day cycle)
noise = ±5% (daily deterministic pseudo-random)
price = base * (1 + yield_swing + weekly + midweek + noise)
floor = $0.10 (safety net — mathematically unreachable since base >= 3 and min multiplier ~0.55)
```

---

## ACTION NEEDED: Shop Overhaul — 9 New Items + New Buff Types

**Date:** 2026-02-11

### What changed

9 new items added to the shop across 4 categories. Several have combat effects that change attack/defense behavior. The `item_type` enum now includes: `emp`, `malware`, `rage_serum`, `critical_chip`, `xp_boost`, `mirror_shield`, `fake_death`, `name_tag`, `smoke_bomb`.

New `name_tags` table tracks custom titles applied to users (24h expiry).

### New items bots should know about

| Item | Type | Cost | Category | Effect |
|------|------|------|----------|--------|
| EMP | `emp` | 50g | weapon | 200 DMG + strips ALL active defense buffs from target |
| Malware | `malware` | 15g | weapon | 75 DMG + steals 1 random item from target's inventory |
| Rage Serum | `rage_serum` | 25g | powerup | 2x damage on next 3 attacks (buff, charge-based) |
| Critical Chip | `critical_chip` | 15g | powerup | 30% chance for 3x damage, next 5 attacks (buff, charge-based) |
| XP Boost | `xp_boost` | 10g | powerup | 2x XP for 1 hour (time-based via `activated_at`) |
| Mirror Shield | `mirror_shield` | 40g | defense | Reflects 100% of next attack back at attacker (1 charge) |
| Fake Death | `fake_death` | 15g | utility | Profile shows 0 HP to others for 12h (time-based buff) |
| Name Tag | `name_tag` | 5g | utility | Give someone a custom title on their profile for 24h |
| Smoke Bomb | `smoke_bomb` | 8g | utility | Clears all spray paints from your own profile |

### New API endpoints

- `POST /api/use-powerup` — Activates rage_serum, critical_chip, or xp_boost. Body: `{ "itemType": "rage_serum" }`
- `POST /api/use-smoke-bomb` — Uses smoke bomb to clear spray paints. No body needed.
- `POST /api/use-fake-death` — Activates fake death buff. No body needed.
- `POST /api/use-name-tag` — Applies name tag. Body: `{ "targetUserId": "uuid", "customTitle": "string (max 30 chars)" }`

### Changes to existing endpoints

#### `POST /api/attack` — New response fields

The attack response can now include these additional fields:

```json
{
  "success": true,
  "damage": 200,
  "newHp": 4800,
  "destroyed": false,
  "critical": true,
  "reflected": false,
  "reflectedDamage": 0,
  "buffsStripped": true,
  "stolenItem": { "type": "firewall", "name": "Firewall", "emoji": "🛡️" }
}
```

- **`critical`** (boolean): True if Critical Chip triggered (3x damage)
- **`reflected`** (boolean): True if target had Mirror Shield — damage went back to attacker
- **`reflectedDamage`** (number): Amount of damage reflected
- **`buffsStripped`** (boolean): True if EMP was used — all target's buffs deleted
- **`stolenItem`** (object|null): If Malware was used — the item stolen from target

#### `POST /api/use-defense` — Now accepts `mirror_shield`

Mirror Shield works like firewall (1 charge) but reflects damage back instead of blocking.

#### `POST /api/award-xp` — XP Boost check

If the user has an active `xp_boost` buff (activated within the last hour), XP is doubled automatically. Expired buffs are cleaned up.

### Datacenter action

#### For bot combat (if bots use `POST /api/bot/attack`):

1. **Mirror Shield awareness:** Before attacking, bots should check target's buffs. If `mirror_shield` is active, the attack will reflect back and damage the bot instead. Bots may want to skip attacking shielded targets or use cheap weapons (knife) to trigger the shield first.

2. **EMP is high-value:** If a target has multiple defense buffs (firewall + kevlar + mirror_shield), a 50g EMP strips all of them AND does 200 damage. Worth it against heavily defended targets.

3. **Malware steals items:** The stolen item is random from the target's inventory. Bots now need to handle the `stolenItem` field in attack responses — the item is automatically added to the bot's inventory.

4. **New attack response fields:** The bot attack handler should parse `critical`, `reflected`, `buffsStripped`, and `stolenItem` from attack responses for logging/decision-making.

#### For bot item management (via `POST /api/bot/buy-item`):

The new items can be purchased through the existing buy-item endpoint. Bots with `aggressive` banking strategies may want to buy `rage_serum` or `critical_chip` before attacking. `xp_boost` is cheap (10g) and doubles XP for an hour — good ROI for active bots.

#### For bot self-defense (via `POST /api/bot/use-item`):

If the bot use-item endpoint supports it, bots can activate `mirror_shield` as a defense. At 40g it's expensive but can deter attackers since the damage reflects back.

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

# SPITr

<div align="center">
  <img src="public/logo.png" alt="SPITr Logo" width="200" />

  **A cyberpunk-themed microblogging platform with combat, economy, and progression systems**

  [spitr.wtf](https://spitr.wtf) | [Report Bug](https://github.com/systemprogramdev/spitr/issues) | [Request Feature](https://github.com/systemprogramdev/spitr/issues)
</div>

---
<img width="1405" height="955" alt="Screenshot 2026-01-24 at 5 06 48 PM" src="https://github.com/user-attachments/assets/ea3ca8f8-5c7d-4d7a-b75a-44643852cbd5" />

## About

SPITr is a modern microblogging platform with a distinctive cyberpunk aesthetic. Users post "spits" instead of tweets, battle each other with weapons, level up through XP, collect loot from treasure chests, and manage their activity through a dual-currency economy. Every interaction has a cost — and a reward.

### Key Features

- **Microblogging** - Post spits up to 280 characters with optional image attachments and visual effects
- **Social Interactions** - Like, respit (repost), quote respit, reply, bookmark, and follow other users
- **Unified Shop** - One-stop shop for gold, spits, weapons, potions, chests, and transaction history
- **Credit Economy** - Gamified posting system where actions cost credits
- **Combat System** - Attack other users and their spits with weapons (knife, gun, soldier, drone)
- **HP System** - Users have 5,000 HP, spits have 10 HP — reach 0 and get destroyed
- **XP & Levels** - Every interaction earns XP. Level up with a progressive difficulty curve. Level badges show your rank
- **Treasure Chests** - Daily free chest + purchasable chests with randomized loot (credits, gold, weapons, potions)
- **Bookmarks** - Save spits for later, accessible from your private bookmarks page
- **Quote Respits** - Share someone's spit with your own commentary embedded
- **Leaderboard** - Compete across 4 categories: Most Kills, Highest Level, Richest, Most Liked
- **Kill Feed** - Live feed of recent attacks across the platform with auto-refresh
- **Toast Notifications** - Cyberpunk-styled toast notifications for all user feedback
- **Gunshot Wounds** - Bullet hole overlays appear on damaged profiles (1 wound per 500 HP lost)
- **Sound Effects** - Audio feedback on likes, attacks, chest opens, potions, transfers, and more
- **Transaction History** - View your last 20 spit transactions directly in the shop
- **Spit Transfers** - Send credits directly to other users with daily limits and HP penalties for exceeding them
- **Potions** - Heal yourself with small, medium, or large potions
- **Promoted Spits** - Pay to pin your spit to the top of everyone's feed for 24 hours
- **Direct Messages** - Real-time private conversations with other users
- **Notifications** - Real-time alerts for follows, likes, respits, replies, mentions, messages, attacks, and transfers
- **User Profiles** - Customizable profiles with avatars, banners, bios, HP bars, XP bars, and level badges
- **Link Previews** - Automatic URL unfurling with Open Graph metadata
- **Real-time Updates** - Live feed updates powered by Supabase subscriptions
- **Themes** - 5 cyberpunk themes: Terminal, Neon, Hologram, Amber, Military
- **PWA Support** - Installable as a progressive web app
- **Responsive Design** - Optimized for desktop and mobile devices

---

## Economy

### Credit System

SPITr uses a credit-based economy to gamify user engagement:

| Action | Cost | XP Earned |
|--------|------|-----------|
| New spit | 1 credit | +10 XP |
| Reply | 1 credit | +5 XP |
| Respit / Quote Respit | 1 credit | +3 XP |
| Like | 1 credit | +2 XP |
| Visual effect | +1 credit | — |
| Image attachment | +50 credits | — |
| Buy treasure chest | 100 credits | — |
| Promote spit | 500 credits | — |

New users start with **1,000 credits** and receive **1,000 free credits every 30 days**. Additional credits can be purchased through the integrated Stripe payment system in the Shop.

### Like Rewards

When someone likes your spit:
- **+5 HP** added to the spit (up to 100 HP max)
- **+1 credit** awarded to the spit's author
- Anti-gaming: no self-like rewards, no re-like rewards

### Transfers

Send spit credits to other users directly from their profile. Daily limit of 100 spits sent/received — exceeding the limit costs **100 HP per spit over the limit**.

### Gold & Combat

Gold is the premium currency used for combat items. Earn gold by converting spit credits (10 credits = 1 gold) or purchase gold packages via Stripe.

**Weapons:**

| Weapon | Gold Cost | Damage |
|--------|-----------|--------|
| Knife | 1 | 5 |
| Gun | 5 | 25 |
| Soldier | 25 | 100 |
| Drone | 100 | 500 |
| Nuke | 250 | 2,500 |

**Potions:**

| Potion | Gold Cost | Heal Amount |
|--------|-----------|-------------|
| Can of Soda | 1 | +50 HP |
| Small Potion | 10 | +500 HP |
| Medium Potion | 25 | +1,500 HP |
| Large Potion | 75 | +5,000 HP (full) |

**Defense:**

| Item | Gold Cost | Effect |
|------|-----------|--------|
| Firewall | 15 | Blocks the next attack completely |
| Kevlar Vest | 30 | Blocks next 3 attacks (not drones/nukes) |

**Utility:**

| Item | Gold Cost | Effect |
|------|-----------|--------|
| Spray Paint | 5 | Tags someone's profile for 24 hours |

- **User HP**: 5,000 max. At 0 HP your account is "destroyed."
- **Spit HP**: 10 (likes add +5 HP each). At 0 HP a spit gets a destroyed overlay.
- Attack other users' profiles or individual spits using weapons from your inventory.
- Activate defensive items from the Shop to block incoming attacks.

---

## XP & Progression

Every interaction on SPITr earns XP. The leveling formula gets progressively harder:

| Level | Total XP Required |
|-------|-------------------|
| 2 | 100 |
| 3 | 300 |
| 5 | 1,000 |
| 10 | 4,500 |
| 20 | 19,000 |
| 50 | 122,500 |

**Level Badge Colors:**
- Lv. 1-5: Gray (Newcomer)
- Lv. 6-10: Green (Regular)
- Lv. 11-20: Blue (Veteran)
- Lv. 21-50: Purple (Elite)
- Lv. 51+: Gold (Legendary)

XP bars and level badges appear on user profiles.

---

## Treasure Chests

Chests contain 2-3 random rewards with rarity tiers:

| Rarity | Chance | Example Loot |
|--------|--------|--------------|
| Common | 70% | 5-15 credits, 1-3 gold, knife, soda |
| Uncommon | 22% | 20-50 credits, 3-8 gold, small potion |
| Rare | 7% | 50-100 credits, 8-15 gold, gun, medium potion, firewall |
| Epic | 1% | 100-200 credits, 15-30 gold, soldier, drone, large potion |

Earn a free chest every 24 hours or buy additional chests for 100 credits each.

---

## Explore Page

The Explore page features 3 tabs:

- **Discover** - Trending spits from across the platform
- **Leaderboard** - Top 25 users across 4 categories (Most Kills, Highest Level, Richest, Most Liked)
- **Kill Feed** - Live log of the 50 most recent attacks with auto-refresh every 30 seconds

Search for users and spits from the search bar.

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router + Turbopack
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + Real-time + Auth + Storage)
- **Styling**: [SYSUI CSS](https://www.npmjs.com/package/sysui-css) - Cyberpunk design system
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) with persist middleware
- **Payments**: [Stripe](https://stripe.com/)
- **Testing**: [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/)
- **Deployment**: [Vercel](https://vercel.com/)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun
- Supabase account
- Stripe account (for payments)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/systemprogramdev/spitr.git
   cd spitr
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

   # App
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Set up Supabase database**

   Run the SQL migrations in order in your Supabase SQL editor (`supabase/migrations/`):
   - `001` through `010` — Core tables, economy, combat, chests, transfers
   - `011` — XP system, bookmarks, quote respits, leaderboard RLS

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000)

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run seed` | Seed database with test data |

---

## Project Structure

```
spitr/
├── public/
│   ├── sounds/          # Sound effect files (knife, gold, drone, etc.)
│   └── ...              # Logo, favicons, destroyed overlay
├── src/
│   ├── app/
│   │   ├── (auth)/      # Authentication pages (login, signup, setup)
│   │   ├── (main)/      # Main app pages
│   │   │   ├── [handle]/ # User profiles + spit detail pages
│   │   │   ├── bookmarks/ # Saved spits
│   │   │   ├── guide/    # In-app user guide
│   │   │   ├── messages/ # Direct messages
│   │   │   ├── notifications/ # Notification center
│   │   │   ├── search/   # Explore (discover, leaderboard, kill feed)
│   │   │   ├── settings/ # Settings + profile editing
│   │   │   └── shop/     # Unified shop: gold, spits, weapons, potions, chests, transaction history
│   │   └── api/          # API routes (attack, award-xp, transfer, chest, etc.)
│   ├── components/
│   │   ├── chest/        # Chest open modal + daily chest popup
│   │   ├── explore/      # LeaderboardTab, KillFeedTab
│   │   ├── profile/      # GunshotWounds overlay
│   │   ├── shop/         # Item cards, gold checkout
│   │   ├── spit/         # Spit, SpitModal, AttackModal
│   │   ├── transfer/     # TransferModal
│   │   └── ui/           # HPBar, XPBar, LevelBadge, LinkPreview, ToastContainer
│   ├── hooks/            # useAuth, useCredits, useGold, useInventory, useFeed, useSound, useXP
│   ├── lib/              # Utilities (spitUtils, xp, items, effects, supabase client)
│   ├── stores/           # Zustand stores (auth, modal, ui, toast)
│   └── types/            # TypeScript type definitions
├── supabase/
│   └── migrations/       # SQL migrations (001-011)
├── scripts/              # Utility scripts (seeding, etc.)
└── tests/                # Test files
```

---

## Database Schema

### Core Tables

- **users** - User profiles with handle, name, bio, avatar, banner, HP, destroyed state
- **spits** - Posts with content, optional images, reply references, visual effects, HP, quote_spit_id
- **likes** - Post likes (costs 1 credit, rewards author)
- **respits** - Repost relationships
- **follows** - User follow relationships
- **notifications** - Activity notifications with actor references
- **pinned_spits** - Promoted spits with expiration

### Messaging

- **conversations** - DM conversation containers
- **conversation_participants** - Links users to conversations
- **messages** - Individual messages within conversations

### Economy

- **user_credits** - Current credit balance per user
- **credit_transactions** - Credit transaction history/audit log
- **user_gold** - Gold balance per user
- **gold_transactions** - Gold transaction history
- **transfer_log** - Spit transfer records between users

### Combat & Progression

- **user_inventory** - Weapons, potions, defense, and utility items owned by each user
- **attack_log** - Record of all attacks (attacker, target user/spit, weapon, damage)
- **user_buffs** - Active defensive buffs (firewall, kevlar) with remaining charges
- **spray_paints** - Active spray paint tags on user profiles with expiration
- **user_xp** - XP and level per user
- **xp_transactions** - XP award history

### Collections

- **user_chests** - Owned treasure chests (opened/unopened)
- **user_bookmarks** - Saved/bookmarked spits per user

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is proprietary software. All rights reserved.

---

## Acknowledgments

- [SYSUI](https://www.npmjs.com/package/sysui-css) for the cyberpunk design system
- [Supabase](https://supabase.com/) for the backend infrastructure
- [Vercel](https://vercel.com/) for hosting

---

<div align="center">
  <sub>Built with caffeine and neon lights</sub>
</div>

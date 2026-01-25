# SPITr - Technical Specification

## Overview

SPITr is a cyberpunk-themed microblogging platform built with Next.js 16, Supabase, and Stripe. Users post "spits" (tweets), interact through likes, respits (retweets), replies, and direct messages, all powered by a credit-based economy.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Email, Google OAuth) |
| Real-time | Supabase Realtime Subscriptions |
| Storage | Supabase Storage (avatars, banners, spit-images) |
| Payments | Stripe (Payment Intents API) |
| Styling | SYSUI CSS + Custom CSS |
| State | Zustand |
| Deployment | Vercel |

---

## Database Schema

### Core Tables

#### `users`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Supabase auth user ID |
| handle | varchar(15) | Unique @username |
| name | varchar(50) | Display name |
| bio | varchar(160) | User bio |
| avatar_url | text | Profile picture URL |
| banner_url | text | Profile banner URL |
| location | varchar(30) | User location |
| website | text | User website |
| created_at | timestamptz | Account creation date |
| updated_at | timestamptz | Last profile update |

#### `spits`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Spit ID |
| user_id | uuid (FK) | Author's user ID |
| content | varchar(280) | Spit text content |
| reply_to_id | uuid (FK) | Parent spit if reply |
| image_url | text | Attached image URL |
| effect | varchar | Visual effect (glitch, pulse, etc.) |
| created_at | timestamptz | Post timestamp |

#### `likes`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Like ID |
| user_id | uuid (FK) | User who liked |
| spit_id | uuid (FK) | Spit that was liked |
| created_at | timestamptz | Like timestamp |

#### `follows`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Follow ID |
| follower_id | uuid (FK) | User following |
| following_id | uuid (FK) | User being followed |
| created_at | timestamptz | Follow timestamp |

#### `notifications`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Notification ID |
| user_id | uuid (FK) | Recipient user |
| type | enum | follow, like, respit, reply, mention |
| actor_id | uuid (FK) | User who triggered |
| spit_id | uuid (FK) | Related spit (optional) |
| read | boolean | Read status |
| created_at | timestamptz | Notification timestamp |

### Messaging Tables

#### `conversations`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Conversation ID |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last message timestamp |

#### `conversation_participants`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Participant ID |
| conversation_id | uuid (FK) | Conversation |
| user_id | uuid (FK) | Participant user |
| last_read_at | timestamptz | Last read timestamp |

#### `messages`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Message ID |
| conversation_id | uuid (FK) | Conversation |
| sender_id | uuid (FK) | Sender user |
| content | text | Message content |
| created_at | timestamptz | Send timestamp |

### Economy Tables

#### `user_credits`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Record ID |
| user_id | uuid (FK) | User |
| balance | integer | Current credit balance |
| free_credits_at | timestamptz | Last free credits timestamp |
| updated_at | timestamptz | Last update |

#### `credit_transactions`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Transaction ID |
| user_id | uuid (FK) | User |
| type | enum | post, reply, respit, purchase, free_monthly, pin_purchase |
| amount | integer | Credits (+/-) |
| balance_after | integer | Balance after transaction |
| reference_id | text | External reference (Stripe payment ID) |
| created_at | timestamptz | Transaction timestamp |

---

## Credit Economy

### Costs
| Action | Cost |
|--------|------|
| Post a spit | 1 credit |
| Reply to a spit | 1 credit |
| Respit | 1 credit |
| Add visual effect | +1 credit |
| Add image | +50 credits |
| Promote spit (24h) | 500 credits |

### Free Actions
- Like a spit
- Follow a user
- Send direct message

### Credit Acquisition
- **Signup bonus**: 1,000 credits
- **Monthly renewal**: 1,000 credits every 30 days (automatic)
- **Purchase packages**:
  - Starter: 100 credits - $1.99
  - Popular: 500 credits - $7.99
  - Mega: 1,500 credits - $19.99
  - Whale: 5,000 credits - $49.99

---

## Features

### Authentication
- Email/password signup and login
- Google OAuth integration
- OAuth users redirected to setup page to choose handle
- Setup page includes: avatar upload, display name, handle, bio

### Spits (Posts)
- 280 character limit
- Optional image attachment (max 5MB)
- Optional visual effects (glitch, pulse, flicker, neon, matrix, hologram, static, cyber)
- Reply threading
- Respit (repost) functionality
- Like/unlike
- Real-time feed updates
- Link detection with clickable URLs
- Link previews with Open Graph metadata
- @mention detection with user notifications
- @mention autocomplete dropdown while typing

### Profiles
- Customizable display name and @handle
- Bio (160 chars), location, website
- Avatar and banner images
- Follower/following counts
- Spit count and credit balance display
- Edit profile with handle change support

### Notifications
- Real-time notification count in navbar
- Types: follow, like, respit, reply, mention
- Unread indicator badges (desktop & mobile)
- Auto-mark as read when viewing

### Direct Messages
- Real-time messaging
- Conversation list with last message preview
- Unread message count badges
- Start new conversation from profile
- Optimistic message sending

### Search & Explore
- Search users by name or handle
- Explore page with recent spits
- Who to follow suggestions

### Settings
- Edit profile (name, handle, bio, avatar, banner)
- Theme selection (Terminal, Neon, Hologram, Amber, Military)
- Scanlines effect toggle
- Account management
- Sign out

---

## API Routes

### Stripe Integration
- `POST /api/stripe/create-payment-intent` - Create payment intent for credit purchase
- `POST /api/stripe/confirm-payment` - Confirm payment and add credits
- `POST /api/stripe/webhook` - Handle Stripe webhook events (with idempotency)

### Utilities
- `GET /api/unfurl?url=` - Fetch Open Graph metadata for link previews

---

## Real-time Subscriptions

| Channel | Events | Purpose |
|---------|--------|---------|
| `messages:{conversationId}` | INSERT | New messages in conversation |
| `unread-messages` | INSERT | New DMs for unread count |
| `unread-notifications` | INSERT, UPDATE | Notification count updates |

---

## Storage Buckets

| Bucket | Purpose | Max Size |
|--------|---------|----------|
| avatars | Profile pictures | 2MB |
| banners | Profile banners | 4MB |
| spit-images | Spit attachments | 5MB |

---

## UI Components

### Layout
- Desktop: Left sidebar, main content, right panel
- Mobile: Top header, bottom navigation, slide-out menu
- Responsive breakpoints at 768px and 1024px

### Design System (SYSUI)
- Cyberpunk aesthetic with neon accents
- Terminal-style panels with dot headers
- Glow effects on primary actions
- Monospace fonts for code/handles
- Scanlines overlay effect (toggleable)

### Navigation Badges
- Credits balance in sidebar
- Unread notification count (desktop sidebar + mobile nav)
- Unread message count (desktop sidebar + mobile nav)

---

## Security

### Authentication
- Supabase Auth with JWT tokens
- Row Level Security (RLS) on all tables
- Service role key for admin operations (OAuth profile creation)

### Payments
- Stripe webhook signature verification
- Idempotency checks prevent double-crediting
- No receipt emails (privacy - hides cardholder name)

### Data
- User can only edit own profile
- User can only delete own spits
- Credits can only be deducted by owner
- DMs only visible to participants

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Deployment

- **Platform**: Vercel
- **Build**: `next build` (Turbopack)
- **Node**: 18+
- **Domain**: spitr.vercel.app

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-01 | Initial release with core features |

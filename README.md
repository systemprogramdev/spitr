# SPITr

<div align="center">
  <img src="public/logo.png" alt="SPITr Logo" width="200" />

  **A cyberpunk-themed microblogging platform**

  [Live Demo](https://spitr.vercel.app) | [Report Bug](https://github.com/systemprogramdev/spitr/issues) | [Request Feature](https://github.com/systemprogramdev/spitr/issues)
</div>

---
<img width="1405" height="955" alt="Screenshot 2026-01-24 at 5 06 48 PM" src="https://github.com/user-attachments/assets/ea3ca8f8-5c7d-4d7a-b75a-44643852cbd5" />

## About

SPITr is a modern microblogging platform with a distinctive cyberpunk aesthetic. Users post "spits" instead of tweets, interact through likes, respits (reposts), and replies, and manage their activity through a unique credit-based economy system.

### Key Features

- **Microblogging** - Post spits up to 280 characters with optional image attachments
- **Social Interactions** - Like, respit (repost), reply, and follow other users
- **Credit Economy** - Gamified posting system where actions cost credits
- **Direct Messages** - Real-time private conversations with other users
- **Notifications** - Real-time alerts for follows, likes, respits, replies, and mentions
- **User Profiles** - Customizable profiles with avatars, bios, and activity feeds
- **Link Previews** - Automatic URL unfurling with Open Graph metadata
- **OAuth Authentication** - Sign in with Google or just normal sign in
- **Real-time Updates** - Live feed updates powered by Supabase subscriptions
- **PWA Support** - Installable as a progressive web app
- **Responsive Design** - Optimized for desktop and mobile devices

### Credit System

SPITr uses a credit-based economy to gamify user engagement:

| Action | Cost |
|--------|------|
| New spit | 1 credit |
| Reply | 1 credit |
| Respit | 1 credit |
| Image attachment | +50 credits |
| Pin purchase | 500 credits |

New users start with **1,000 credits** and receive **1,000 free credits every 30 days**. Additional credits can be purchased through the integrated Stripe payment system. (test mode for now)

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + Real-time + Auth)
- **Styling**: [SYSUI CSS](https://www.npmjs.com/package/sysui-css) - Cyberpunk design system
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
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

   Run the SQL migrations in your Supabase SQL editor to create the required tables:
   - `users` - User profiles
   - `spits` - Posts/tweets
   - `likes` - Post likes
   - `follows` - User follow relationships
   - `notifications` - User notifications
   - `conversations` & `messages` - Direct messaging
   - `conversation_participants` - DM participants
   - `user_credits` & `credit_transactions` - Credit system

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
├── public/              # Static assets (logo, favicons, etc.)
├── src/
│   ├── app/             # Next.js App Router pages
│   │   ├── (auth)/      # Authentication pages
│   │   ├── (main)/      # Main app pages (feed, profile, messages, etc.)
│   │   ├── api/         # API routes
│   │   └── layout.tsx   # Root layout
│   ├── components/      # React components
│   │   ├── spit/        # Spit-related components
│   │   └── ...          # Other UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and configurations
│   │   └── supabase/    # Supabase client setup
│   ├── stores/          # Zustand state stores
│   ├── styles/          # Global styles
│   └── types/           # TypeScript type definitions
├── scripts/             # Utility scripts (seeding, etc.)
└── tests/               # Test files
```

---

## Database Schema

### Core Tables

- **users** - User profiles with handle, name, bio, avatar
- **spits** - Posts with content, optional images, reply references
- **likes** - Many-to-many relationship for post likes
- **follows** - User follow relationships
- **notifications** - Activity notifications with actor references

### Messaging

- **conversations** - DM conversation containers
- **conversation_participants** - Links users to conversations
- **messages** - Individual messages within conversations

### Economy

- **user_credits** - Current credit balance per user
- **credit_transactions** - Credit transaction history/audit log

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

-- SPITr Database Schema
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
create extension if not exists "pg_trgm";

-- ============================================
-- USERS
-- ============================================
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  handle text unique not null,
  name text not null,
  bio text,
  avatar_url text,
  banner_url text,
  location text,
  website text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint handle_length check (char_length(handle) >= 3 and char_length(handle) <= 15),
  constraint handle_format check (handle ~ '^[a-zA-Z0-9_]+$')
);

create unique index users_handle_lower_idx on public.users (lower(handle));
create index users_name_search_idx on public.users using gin (name gin_trgm_ops);

-- ============================================
-- SPITS (Posts)
-- ============================================
create table public.spits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  content text not null,
  image_url text,
  reply_to_id uuid references public.spits(id) on delete set null,
  created_at timestamptz default now(),

  constraint content_length check (char_length(content) <= 280 and char_length(content) > 0)
);

create index spits_user_id_idx on public.spits (user_id);
create index spits_reply_to_id_idx on public.spits (reply_to_id);
create index spits_created_at_idx on public.spits (created_at desc);
create index spits_content_search_idx on public.spits using gin (content gin_trgm_ops);

-- ============================================
-- LIKES
-- ============================================
create table public.likes (
  user_id uuid references public.users(id) on delete cascade,
  spit_id uuid references public.spits(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, spit_id)
);

create index likes_spit_id_idx on public.likes (spit_id);

-- ============================================
-- RESPITS (Reposts)
-- ============================================
create table public.respits (
  user_id uuid references public.users(id) on delete cascade,
  spit_id uuid references public.spits(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, spit_id)
);

create index respits_spit_id_idx on public.respits (spit_id);
create index respits_user_id_idx on public.respits (user_id);

-- ============================================
-- FOLLOWS
-- ============================================
create table public.follows (
  follower_id uuid references public.users(id) on delete cascade,
  following_id uuid references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id != following_id)
);

create index follows_follower_id_idx on public.follows (follower_id);
create index follows_following_id_idx on public.follows (following_id);

-- ============================================
-- CONVERSATIONS (DMs)
-- ============================================
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  last_read_at timestamptz,
  deleted_at timestamptz,
  primary key (conversation_id, user_id)
);

create index conv_participants_user_idx on public.conversation_participants (user_id);

-- ============================================
-- MESSAGES
-- ============================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.users(id) on delete cascade not null,
  content text not null,
  image_url text,
  created_at timestamptz default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- ============================================
-- NOTIFICATIONS
-- ============================================
create type notification_type as enum (
  'follow',
  'like',
  'respit',
  'reply',
  'mention'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type notification_type not null,
  actor_id uuid references public.users(id) on delete cascade not null,
  spit_id uuid references public.spits(id) on delete cascade,
  read boolean default false,
  created_at timestamptz default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read = false;

-- ============================================
-- CREDITS SYSTEM
-- ============================================
create table public.user_credits (
  user_id uuid references public.users(id) on delete cascade primary key,
  balance int not null default 1000,
  free_credits_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint balance_non_negative check (balance >= 0)
);

create type transaction_type as enum (
  'free_monthly',
  'purchase',
  'post',
  'reply',
  'respit',
  'pin_purchase'
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type transaction_type not null,
  amount int not null,
  balance_after int not null,
  reference_id uuid,
  created_at timestamptz default now()
);

create index credit_tx_user_idx on public.credit_transactions (user_id, created_at desc);

-- ============================================
-- PINNED SPITS
-- ============================================
create table public.pinned_spits (
  id uuid primary key default gen_random_uuid(),
  spit_id uuid references public.spits(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  unique(user_id) -- Only one active pin per user
);

create index pinned_spits_expires_idx on public.pinned_spits (expires_at);

create table public.pin_views (
  pin_id uuid references public.pinned_spits(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  viewed_at timestamptz default now(),
  primary key (pin_id, user_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.spits enable row level security;
alter table public.likes enable row level security;
alter table public.respits enable row level security;
alter table public.follows enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.user_credits enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.pinned_spits enable row level security;
alter table public.pin_views enable row level security;

-- USERS policies
create policy "Users are viewable by everyone"
  on public.users for select using (true);

create policy "Users can insert own profile"
  on public.users for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

-- SPITS policies
create policy "Spits are viewable by everyone"
  on public.spits for select using (true);

create policy "Authenticated users can create spits"
  on public.spits for insert with check (auth.uid() = user_id);

create policy "Users can delete own spits"
  on public.spits for delete using (auth.uid() = user_id);

-- LIKES policies
create policy "Likes are viewable by everyone"
  on public.likes for select using (true);

create policy "Authenticated users can like"
  on public.likes for insert with check (auth.uid() = user_id);

create policy "Users can unlike"
  on public.likes for delete using (auth.uid() = user_id);

-- RESPITS policies
create policy "Respits are viewable by everyone"
  on public.respits for select using (true);

create policy "Authenticated users can respit"
  on public.respits for insert with check (auth.uid() = user_id);

create policy "Users can undo respit"
  on public.respits for delete using (auth.uid() = user_id);

-- FOLLOWS policies
create policy "Follows are viewable by everyone"
  on public.follows for select using (true);

create policy "Authenticated users can follow"
  on public.follows for insert with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete using (auth.uid() = follower_id);

-- CONVERSATIONS policies
create policy "Users can view own conversations"
  on public.conversations for select using (
    exists (
      select 1 from conversation_participants
      where conversation_id = id and user_id = auth.uid()
    )
  );

create policy "Authenticated users can create conversations"
  on public.conversations for insert with check (true);

-- CONVERSATION PARTICIPANTS policies
create policy "Users can view own participations"
  on public.conversation_participants for select using (user_id = auth.uid());

create policy "Users can join conversations"
  on public.conversation_participants for insert with check (user_id = auth.uid());

create policy "Users can update own participation"
  on public.conversation_participants for update using (user_id = auth.uid());

-- MESSAGES policies
create policy "Users can view messages in their conversations"
  on public.messages for select using (
    exists (
      select 1 from conversation_participants
      where conversation_id = messages.conversation_id
      and user_id = auth.uid()
      and deleted_at is null
    )
  );

create policy "Users can send messages"
  on public.messages for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from conversation_participants
      where conversation_id = messages.conversation_id
      and user_id = auth.uid()
    )
  );

-- NOTIFICATIONS policies
create policy "Users can view own notifications"
  on public.notifications for select using (user_id = auth.uid());

create policy "System can create notifications"
  on public.notifications for insert with check (true);

create policy "Users can update own notifications"
  on public.notifications for update using (user_id = auth.uid());

-- USER CREDITS policies
create policy "Users can view own credits"
  on public.user_credits for select using (user_id = auth.uid());

create policy "Users can insert own credits"
  on public.user_credits for insert with check (user_id = auth.uid());

create policy "Users can update own credits"
  on public.user_credits for update using (user_id = auth.uid());

-- CREDIT TRANSACTIONS policies
create policy "Users can view own transactions"
  on public.credit_transactions for select using (user_id = auth.uid());

create policy "Users can insert own transactions"
  on public.credit_transactions for insert with check (user_id = auth.uid());

-- PINNED SPITS policies
create policy "Pinned spits are viewable by everyone"
  on public.pinned_spits for select using (true);

create policy "Users can pin own spits"
  on public.pinned_spits for insert with check (auth.uid() = user_id);

create policy "Users can unpin own spits"
  on public.pinned_spits for delete using (auth.uid() = user_id);

-- PIN VIEWS policies
create policy "Pin views are insertable by authenticated users"
  on public.pin_views for insert with check (auth.uid() = user_id);

create policy "Users can view own pin views"
  on public.pin_views for select using (user_id = auth.uid());

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at
  before update on public.users
  for each row execute function update_updated_at();

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function update_updated_at();

create trigger user_credits_updated_at
  before update on public.user_credits
  for each row execute function update_updated_at();

-- Update conversation timestamp when new message is sent
create or replace function update_conversation_timestamp()
returns trigger as $$
begin
  update conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

create trigger messages_update_conversation
  after insert on public.messages
  for each row execute function update_conversation_timestamp();

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Run these in Supabase Dashboard > Storage

-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
-- insert into storage.buckets (id, name, public) values ('banners', 'banners', true);
-- insert into storage.buckets (id, name, public) values ('spit-images', 'spit-images', true);
-- insert into storage.buckets (id, name, public) values ('dm-images', 'dm-images', false);

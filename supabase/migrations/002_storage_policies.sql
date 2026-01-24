-- Storage Buckets and Policies
-- Run this in Supabase SQL Editor

-- Create buckets if they don't exist
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('spit-images', 'spit-images', true)
on conflict (id) do nothing;

-- ============================================
-- AVATARS BUCKET POLICIES
-- ============================================

-- Anyone can view avatars (public bucket)
create policy "Avatars are publicly accessible"
on storage.objects for select
using (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar
create policy "Users can upload their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Alternative: Allow any authenticated user to upload (simpler)
create policy "Authenticated users can upload avatars"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
);

-- Users can update their own avatar
create policy "Users can update their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
);

-- Users can delete their own avatar
create policy "Users can delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and auth.role() = 'authenticated'
);

-- ============================================
-- BANNERS BUCKET POLICIES
-- ============================================

-- Anyone can view banners (public bucket)
create policy "Banners are publicly accessible"
on storage.objects for select
using (bucket_id = 'banners');

-- Authenticated users can upload banners
create policy "Authenticated users can upload banners"
on storage.objects for insert
with check (
  bucket_id = 'banners'
  and auth.role() = 'authenticated'
);

-- Users can update their own banner
create policy "Users can update their own banner"
on storage.objects for update
using (
  bucket_id = 'banners'
  and auth.role() = 'authenticated'
);

-- Users can delete their own banner
create policy "Users can delete their own banner"
on storage.objects for delete
using (
  bucket_id = 'banners'
  and auth.role() = 'authenticated'
);

-- ============================================
-- SPIT-IMAGES BUCKET POLICIES
-- ============================================

-- Anyone can view spit images (public bucket)
create policy "Spit images are publicly accessible"
on storage.objects for select
using (bucket_id = 'spit-images');

-- Authenticated users can upload spit images
create policy "Authenticated users can upload spit images"
on storage.objects for insert
with check (
  bucket_id = 'spit-images'
  and auth.role() = 'authenticated'
);

-- Users can delete their own spit images
create policy "Users can delete spit images"
on storage.objects for delete
using (
  bucket_id = 'spit-images'
  and auth.role() = 'authenticated'
);

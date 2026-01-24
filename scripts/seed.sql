-- SPITr Test Data Seed Script
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- First, create test users in auth.users (you'll need to do this manually in Authentication tab)
-- Or use these INSERT statements if you have the service role

-- Create test user profiles (run after creating auth users)
-- NOTE: Replace the UUIDs below with the actual user IDs from your auth.users table
-- You can find these in Authentication > Users

-- For now, let's insert spits for your existing user
-- First, let's see what users exist:
-- SELECT id, handle, name FROM users;

-- Insert sample spits (these will use your existing user)
-- Replace 'YOUR_USER_ID' with your actual user ID from the users table

DO $$
DECLARE
    user_id uuid;
    spit_ids uuid[] := ARRAY[]::uuid[];
    new_spit_id uuid;
BEGIN
    -- Get the first user (your account)
    SELECT id INTO user_id FROM users LIMIT 1;

    IF user_id IS NULL THEN
        RAISE NOTICE 'No users found. Please create an account first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Creating spits for user: %', user_id;

    -- Insert spits
    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'Just deployed to production on a Friday. Living dangerously.', NOW() - INTERVAL '1 hour') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'The best code is the code you don''t have to write.', NOW() - INTERVAL '2 hours') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'Debugging is like being a detective in a crime movie where you''re also the murderer.', NOW() - INTERVAL '3 hours') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'rm -rf node_modules && npm install - the universal fix', NOW() - INTERVAL '5 hours') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'Coffee: because production incidents don''t wait for sleep.', NOW() - INTERVAL '8 hours') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'Documentation? You mean the code comments I''ll write later?', NOW() - INTERVAL '1 day') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'git push --force is how I assert dominance.', NOW() - INTERVAL '1 day 2 hours') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'If it works, don''t touch it. If you touch it, may God help you.', NOW() - INTERVAL '1 day 5 hours') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'There are only 10 types of people in this world...', NOW() - INTERVAL '2 days') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'Dark mode is the only mode.', NOW() - INTERVAL '2 days 3 hours') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'I don''t always test my code, but when I do, I do it in production.', NOW() - INTERVAL '3 days') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'The S in IoT stands for Security.', NOW() - INTERVAL '3 days 5 hours') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'Legacy code is just code that works and you''re afraid to touch.', NOW() - INTERVAL '4 days') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'Microservices: because one monolith wasn''t enough to debug.', NOW() - INTERVAL '5 days') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    INSERT INTO spits (user_id, content, created_at) VALUES
    (user_id, 'REST in peace, SOAP.', NOW() - INTERVAL '6 days') RETURNING id INTO new_spit_id;
    spit_ids := array_append(spit_ids, new_spit_id);

    -- Add some replies to the first few spits
    INSERT INTO spits (user_id, content, reply_to_id, created_at) VALUES
    (user_id, 'This is so true!', spit_ids[1], NOW() - INTERVAL '30 minutes');

    INSERT INTO spits (user_id, content, reply_to_id, created_at) VALUES
    (user_id, 'Been there, done that', spit_ids[2], NOW() - INTERVAL '1 hour 30 minutes');

    INSERT INTO spits (user_id, content, reply_to_id, created_at) VALUES
    (user_id, 'Facts.', spit_ids[3], NOW() - INTERVAL '2 hours 30 minutes');

    RAISE NOTICE 'Created % spits and 3 replies', array_length(spit_ids, 1);
END $$;

-- Verify the data
SELECT
    s.id,
    s.content,
    s.created_at,
    u.handle as author
FROM spits s
JOIN users u ON s.user_id = u.id
ORDER BY s.created_at DESC
LIMIT 20;

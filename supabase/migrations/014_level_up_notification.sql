-- 014: Add 'level_up' to notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'level_up';

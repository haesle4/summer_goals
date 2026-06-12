-- Run this in Supabase SQL Editor to enable day scheduling, completions, and per-habit chat.

-- Per-user habit membership with schedule + completion tracking
CREATE TABLE IF NOT EXISTS habit_memberships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    days INTEGER[] NOT NULL DEFAULT '{}',
    completed_dates DATE[] NOT NULL DEFAULT '{}',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(habit_id, username)
);

-- Optional category for chart legend (wellness | social | learning)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'wellness';

-- habit = recurring task, goal = longer-term goal (same UI, different tab)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'habit';

-- Goal deadline (goals only; habits use day-of-week schedule)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS deadline DATE;

-- Per-habit chat: NULL habit_id = General chat (legacy messages stay here)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS habit_id UUID REFERENCES habits(id) ON DELETE CASCADE;

-- RLS for memberships
ALTER TABLE habit_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read memberships" ON habit_memberships;
CREATE POLICY "Anyone can read memberships" ON habit_memberships
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert memberships" ON habit_memberships;
CREATE POLICY "Anyone can insert memberships" ON habit_memberships
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update memberships" ON habit_memberships;
CREATE POLICY "Anyone can update memberships" ON habit_memberships
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete memberships" ON habit_memberships;
CREATE POLICY "Anyone can delete memberships" ON habit_memberships
    FOR DELETE USING (true);

-- Backfill memberships from existing participants (all days selected by default)
INSERT INTO habit_memberships (habit_id, username, days)
SELECT h.id, p.username, ARRAY[0, 1, 2, 3, 4, 5, 6]
FROM habits h
CROSS JOIN LATERAL unnest(h.participants) AS p(username)
ON CONFLICT (habit_id, username) DO NOTHING;

-- Schedule frequency per member: 'days' = specific weekdays, 'weekly' = once a week, 'monthly' = once a month
ALTER TABLE habit_memberships ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'days';

-- Per-user finish-by date for goals (overrides the creator's group deadline for that member)
ALTER TABLE habit_memberships ADD COLUMN IF NOT EXISTS goal_deadline DATE;

-- Completion events with optional comment, powers the home-page activity feed
CREATE TABLE IF NOT EXISTS completions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read completions" ON completions;
CREATE POLICY "Anyone can read completions" ON completions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert completions" ON completions;
CREATE POLICY "Anyone can insert completions" ON completions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete completions" ON completions;
CREATE POLICY "Anyone can delete completions" ON completions
    FOR DELETE USING (true);

-- Progressive jackpot pool (single shared row for all players)
CREATE TABLE IF NOT EXISTS slot_jackpots (
  id TEXT PRIMARY KEY DEFAULT 'global',
  mini_pool NUMERIC NOT NULL DEFAULT 100,
  major_pool NUMERIC NOT NULL DEFAULT 1000,
  mega_pool NUMERIC NOT NULL DEFAULT 10000,
  last_mini_winner TEXT,
  last_major_winner TEXT,
  last_mega_winner TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the global row
INSERT INTO slot_jackpots (id, mini_pool, major_pool, mega_pool)
VALUES ('global', 100, 1000, 10000)
ON CONFLICT (id) DO NOTHING;

-- No RLS needed — accessed only via admin client (service role)
-- Public read access for displaying jackpot amounts
ALTER TABLE slot_jackpots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read jackpots"
  ON slot_jackpots FOR SELECT
  USING (true);

-- Add effect column to spits table
ALTER TABLE public.spits ADD COLUMN IF NOT EXISTS effect text;

-- Add index for filtering by effect (optional, for analytics)
CREATE INDEX IF NOT EXISTS spits_effect_idx ON public.spits (effect) WHERE effect IS NOT NULL;

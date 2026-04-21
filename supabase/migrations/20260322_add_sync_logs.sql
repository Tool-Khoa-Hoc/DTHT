-- Migration: Add sync logs and last_synced_at
-- Date: 2026-03-22

-- 1. Add last_synced_at to exam_keys if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_keys' AND column_name='last_synced_at') THEN
        ALTER TABLE public.exam_keys ADD COLUMN last_synced_at timestamptz DEFAULT now();
    END IF;
END $$;

-- 2. Create sync_logs table if not exists
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id text NOT NULL,
    status text NOT NULL, -- 'success', 'failed', 'skipped'
    action text NOT NULL, -- 'upload', 'comment', 'uncomment'
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 3. Enable RLS (optional, depends on project policy)
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- 4. Add policy for service role (usually already has full access)
-- CREATE POLICY "Service role full access" ON public.sync_logs FOR ALL USING (true);

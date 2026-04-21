-- 1. Add role column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' NOT NULL;

-- 2. Update the documents table RLS to allow Admins to insert, update and delete
-- Documents now act as a library where only admins can upload, but anyone can read.

-- Ensure RLS is enabled on documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for documents" ON public.documents;
DROP POLICY IF EXISTS "Allow admins to insert documents" ON public.documents;
DROP POLICY IF EXISTS "Allow admins to update documents" ON public.documents;
DROP POLICY IF EXISTS "Allow admins to delete documents" ON public.documents;

-- Allow public read access (if the document is public, or we just allow all for now)
CREATE POLICY "Allow public read access for documents" ON public.documents
    FOR SELECT USING (true);

-- Allow Admins to INSERT
CREATE POLICY "Allow admins to insert documents" ON public.documents
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Allow Admins to UPDATE
CREATE POLICY "Allow admins to update documents" ON public.documents
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Allow Admins to DELETE
CREATE POLICY "Allow admins to delete documents" ON public.documents
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

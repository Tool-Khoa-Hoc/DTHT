CREATE TABLE campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  target text NOT NULL,
  is_completed boolean DEFAULT false,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

--- Enable RLS on campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

--- Policies
--- Read: Users can view their own campaigns + any public campaigns
CREATE POLICY "Users can view public or own campaigns" ON campaigns FOR SELECT USING (is_public = true OR auth.uid() = user_id);

--- Insert: Users can insert their own campaigns
CREATE POLICY "Users can insert own campaigns" ON campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);

--- Update: Users can update their own campaigns
CREATE POLICY "Users can update own campaigns" ON campaigns FOR UPDATE USING (auth.uid() = user_id);

--- Delete: Users can delete their own campaigns
CREATE POLICY "Users can delete own campaigns" ON campaigns FOR DELETE USING (auth.uid() = user_id);

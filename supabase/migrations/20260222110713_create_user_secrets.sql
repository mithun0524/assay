CREATE TABLE IF NOT EXISTS user_secrets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  github_token text,
  openrouter_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own secrets" ON user_secrets
  FOR ALL USING (auth.uid() = user_id);

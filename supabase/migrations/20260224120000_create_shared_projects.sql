CREATE TABLE IF NOT EXISTS shared_projects (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Project',
  files jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shared_projects ENABLE ROW LEVEL SECURITY;

-- Anyone can read shared projects (public links)
CREATE POLICY "Shared projects are publicly readable"
  ON shared_projects FOR SELECT
  USING (true);

-- Only the owner can insert
CREATE POLICY "Users can create their own shared projects"
  ON shared_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the owner can delete
CREATE POLICY "Users can delete their own shared projects"
  ON shared_projects FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE user_secrets ADD COLUMN IF NOT EXISTS vercel_token text;
ALTER TABLE user_secrets ADD COLUMN IF NOT EXISTS vercel_project_id text;

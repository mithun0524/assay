# Supabase setup

Everything Assay needs from Supabase, and why. Follow top to bottom on a
fresh project.

## 1. Environment

```bash
cp .env.example .env.local
supabase link --project-ref <your-project-ref>
supabase projects api-keys --project-ref <your-project-ref>
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`.

The service-role key is not optional. Two paths break silently without it:

- `/api/auth/callback` stores the GitHub provider token with the admin client.
  Without the key the upsert throws, and the user ends up signed in but with
  GitHub permanently "not linked".
- `/api/share` reads a shared project by id with the admin client, because the
  table is deliberately not readable by `anon`.

## 2. Redirect URLs

Supabase → Authentication → URL Configuration → **Redirect URLs**:

```
http://localhost:3000/api/auth/callback
http://localhost:3001/api/auth/callback
https://<your-domain>/api/auth/callback
```

If the callback isn't allow-listed, Supabase silently falls back to the
project's Site URL and drops the user on `/?code=…`, where nothing exchanges
the code. `proxy.ts` forwards a stray `?code=` to the callback as a safety net,
but fix the allow-list rather than relying on it.

## 3. Providers

Auth → Providers → GitHub. The app requests `repo user:email` when linking, so
the OAuth app needs those scopes. Set the callback to
`https://<ref>.supabase.co/auth/v1/callback` (Supabase's, not the app's).

## 4. Schema

```bash
supabase db push          # applies supabase/migrations/*
supabase migration list --linked
```

Tables:

| Table | Holds | Read by |
|---|---|---|
| `user_secrets` | OpenRouter / GitHub / Vercel tokens, one row per user | owner only |
| `shared_projects` | immutable snapshot of a shared project | server only, by id |

## 5. Verify RLS

```bash
supabase db advisors --linked --type security
```

Then confirm from outside that `anon` cannot read either table:

```bash
URL=$(grep URL .env.local | cut -d= -f2-)
KEY=$(grep ANON .env.local | cut -d= -f2-)
curl -s "$URL/rest/v1/shared_projects?select=id" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
curl -s "$URL/rest/v1/user_secrets?select=user_id" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

Both must return `[]`. Anything else means a policy regressed.

`shared_projects` shipped with `FOR SELECT USING (true)`, which made every
shared project — full source and the owner's `user_id` — readable by anyone
holding the anon key. The anon key is in the browser bundle, so that was
everyone. Migration `20260809060216_harden_rls_policies.sql` removes it.

## Free-tier limits worth knowing

| | Limit | Where it bites |
|---|---|---|
| Database | 500 MB | `shared_projects.files` is JSONB; /api/share caps a share at 10 MB |
| Storage | 1 GB | unused today |
| MAU | 50,000 | |
| Egress | 5 GB/mo | large project snapshots |
| Pausing | after 7 days idle | a paused project 500s every request |

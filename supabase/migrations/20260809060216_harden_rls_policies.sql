-- Harden RLS on user_secrets and shared_projects.
--
-- Two problems this fixes, both verified against the live database:
--
-- 1. shared_projects allowed `FOR SELECT USING (true)`. The anon key ships in
--    the browser bundle, so that made every shared project — full source plus
--    the owner's user_id — enumerable by anyone, with no share link. Share
--    links are supposed to be gated by an unguessable UUID.
--
-- 2. user_secrets used a single `FOR ALL USING (auth.uid() = user_id)` policy
--    with no WITH CHECK. USING is only evaluated against existing rows, so
--    nothing stopped a user INSERTing a row owned by someone else, or UPDATEing
--    their own row to point at another user_id.
--
-- Public share reads now go through /api/share, which validates the id and uses
-- the service-role client server-side. The browser never reads the table.

/* ── user_secrets ───────────────────────────────────────── */

DROP POLICY IF EXISTS "Users can manage own secrets" ON user_secrets;

CREATE POLICY "secrets_select_own" ON user_secrets
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "secrets_insert_own" ON user_secrets
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Both clauses: USING picks the row, WITH CHECK stops the row being
-- reassigned to another user on the way out.
CREATE POLICY "secrets_update_own" ON user_secrets
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "secrets_delete_own" ON user_secrets
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

/* ── shared_projects ────────────────────────────────────── */

DROP POLICY IF EXISTS "Shared projects are publicly readable" ON shared_projects;
DROP POLICY IF EXISTS "Users can create their own shared projects" ON shared_projects;
DROP POLICY IF EXISTS "Users can delete their own shared projects" ON shared_projects;

-- Owners can list their own shares (for a future "my shares" view).
-- Nobody else can read the table directly; public access is server-side only.
CREATE POLICY "shares_select_own" ON shared_projects
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "shares_insert_own" ON shared_projects
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "shares_delete_own" ON shared_projects
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Shares are immutable snapshots — no UPDATE policy on purpose.

CREATE INDEX IF NOT EXISTS shared_projects_user_id_idx
  ON shared_projects (user_id);

CREATE INDEX IF NOT EXISTS user_secrets_user_id_idx
  ON user_secrets (user_id);

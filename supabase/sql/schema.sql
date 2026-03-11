-- ============================================================
-- StandupLog Complete Database Schema
-- Version: Final v3 — Optimized Indexing
-- ============================================================


-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  invited_email text NOT NULL,
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz
);

CREATE TABLE IF NOT EXISTS standups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id uuid REFERENCES organisations(id) ON DELETE CASCADE,
  yesterday text NOT NULL DEFAULT '',
  today text NOT NULL DEFAULT '',
  blockers text NOT NULL DEFAULT '',
  standup_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add org_id to standups if it does not exist yet
ALTER TABLE standups
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id) ON DELETE CASCADE;


-- ============================================================
-- PARTIAL UNIQUE INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_org_member
  ON org_members (org_id, user_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_org_member
  ON org_members (org_id, invited_email)
  WHERE status = 'pending';


-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE standups ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SECURITY DEFINER FUNCTION
-- Prevents infinite recursion in RLS policies.
-- ============================================================

CREATE OR REPLACE FUNCTION is_org_member(check_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = check_org_id
    AND org_members.user_id = auth.uid()
    AND org_members.status = 'active'
  );
$$;


-- ============================================================
-- RLS POLICIES: organisations
-- ============================================================

DROP POLICY IF EXISTS "Organisations: Users can create organisations" ON organisations;
CREATE POLICY "Organisations: Users can create organisations"
  ON organisations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Organisations: Members can view organisations" ON organisations;
CREATE POLICY "Organisations: Members can view organisations"
  ON organisations FOR SELECT TO authenticated
  USING (
    is_org_member(organisations.id)
    OR auth.uid() = created_by
  );

DROP POLICY IF EXISTS "Organisations: Creators can update organisations" ON organisations;
CREATE POLICY "Organisations: Creators can update organisations"
  ON organisations FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Organisations: Creators can delete organisations" ON organisations;
CREATE POLICY "Organisations: Creators can delete organisations"
  ON organisations FOR DELETE TO authenticated
  USING (auth.uid() = created_by);


-- ============================================================
-- RLS POLICIES: org_members
-- ============================================================

DROP POLICY IF EXISTS "Org Members: Active members can view their organisation's members" ON org_members;
CREATE POLICY "Org Members: Active members can view their organisation's members"
  ON org_members FOR SELECT TO authenticated
  USING (
    is_org_member(org_members.org_id)
    OR
    (org_members.invited_email = auth.email() AND org_members.status = 'pending')
  );

DROP POLICY IF EXISTS "Service role can insert org members" ON org_members;
CREATE POLICY "Service role can insert org members"
  ON org_members FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Org Members: Users can insert own active membership" ON org_members;
CREATE POLICY "Org Members: Users can insert own active membership"
  ON org_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'active'
  );

DROP POLICY IF EXISTS "Org Members: Users can activate their own invite" ON org_members;
CREATE POLICY "Org Members: Users can activate their own invite"
  ON org_members FOR UPDATE TO authenticated
  USING (
    org_members.user_id IS NULL
    AND org_members.invited_email = auth.email()
    AND org_members.status = 'pending'
  )
  WITH CHECK (
    org_members.user_id = auth.uid()
    AND org_members.status = 'active'
    AND org_members.invited_email = auth.email()
  );

DROP POLICY IF EXISTS "Org Members: Users can delete their own membership" ON org_members;
CREATE POLICY "Org Members: Users can delete their own membership"
  ON org_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Org Members: Owners can remove members" ON org_members;
CREATE POLICY "Org Members: Owners can remove members"
  ON org_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organisations
      WHERE organisations.id = org_members.org_id
      AND organisations.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org Members: Active members can invite new members" ON org_members;


-- ============================================================
-- RLS POLICIES: standups
-- ============================================================

DROP POLICY IF EXISTS "Users can view own standups" ON standups;
DROP POLICY IF EXISTS "Users can create own standups" ON standups;
DROP POLICY IF EXISTS "Users can update own standups" ON standups;
DROP POLICY IF EXISTS "Users can delete own standups" ON standups;
DROP POLICY IF EXISTS "Standups: Users can view own standups within their organisation" ON standups;
DROP POLICY IF EXISTS "Standups: Users can create own standups within their organisation" ON standups;
DROP POLICY IF EXISTS "Standups: Users can update own standups within their organisation" ON standups;
DROP POLICY IF EXISTS "Standups: Users can delete own standups within their organisation" ON standups;
DROP POLICY IF EXISTS "Standups: Active members can view all standups in their organisation" ON standups;

CREATE POLICY "Standups: Active members can view all standups in their organisation"
  ON standups FOR SELECT TO authenticated
  USING (is_org_member(standups.org_id));

CREATE POLICY "Standups: Users can create own standups within their organisation"
  ON standups FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND is_org_member(standups.org_id)
  );

CREATE POLICY "Standups: Users can update own standups within their organisation"
  ON standups FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Standups: Users can delete own standups within their organisation"
  ON standups FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- ============================================================
-- INDEXES
-- Strategy:
--   - B-tree indexes on all foreign keys and filter columns
--   - Composite indexes for the most common multi-column queries
--   - Partial indexes for filtered queries (active/pending)
--   - DESC index on created_at for newest-first sorting
--   - Index on standup_date for today's standups queries
-- ============================================================


-- ------------------------------------------------------------
-- organisations indexes
-- ------------------------------------------------------------

-- Lookup orgs by their creator (used in ownership checks and RLS)
CREATE INDEX IF NOT EXISTS organisations_created_by_idx
  ON organisations (created_by);

-- Newest orgs first (used in team switcher list)
CREATE INDEX IF NOT EXISTS organisations_created_at_idx
  ON organisations (created_at DESC);


-- ------------------------------------------------------------
-- org_members indexes
-- ------------------------------------------------------------

-- Most common query: all members in an org
CREATE INDEX IF NOT EXISTS org_members_org_id_idx
  ON org_members (org_id);

-- Lookup membership by user (used in is_org_member + team switcher)
CREATE INDEX IF NOT EXISTS org_members_user_id_idx
  ON org_members (user_id);

-- Lookup by invited email (used in invite checks and pending flow)
CREATE INDEX IF NOT EXISTS org_members_invited_email_idx
  ON org_members (invited_email);

-- Filter by status alone (used in pending/active queries)
CREATE INDEX IF NOT EXISTS org_members_status_idx
  ON org_members (status);

-- Composite: org + status — most frequent combination query
-- e.g. "all active members in org X"
CREATE INDEX IF NOT EXISTS org_members_org_id_status_idx
  ON org_members (org_id, status);

-- Composite: user + status — used in is_org_member function constantly
-- Critical for RLS performance on every authenticated request
CREATE INDEX IF NOT EXISTS org_members_user_id_status_idx
  ON org_members (user_id, status);

-- Partial index: only active members — fastest path for is_org_member
CREATE INDEX IF NOT EXISTS org_members_active_idx
  ON org_members (org_id, user_id)
  WHERE status = 'active';

-- Partial index: only pending invites — fast lookup for onboarding flow
CREATE INDEX IF NOT EXISTS org_members_pending_email_idx
  ON org_members (invited_email)
  WHERE status = 'pending';


-- ------------------------------------------------------------
-- standups indexes
-- ------------------------------------------------------------

-- Lookup standups by user
CREATE INDEX IF NOT EXISTS standups_user_id_idx
  ON standups (user_id);

-- Lookup standups by org (used in team standups view)
CREATE INDEX IF NOT EXISTS standups_org_id_idx
  ON standups (org_id);

-- Filter by date (used for today's standups)
CREATE INDEX IF NOT EXISTS standups_standup_date_idx
  ON standups (standup_date);

-- Sort newest first (used in history page)
CREATE INDEX IF NOT EXISTS standups_created_at_idx
  ON standups (created_at DESC);

-- Composite: org + date — most critical query in the whole app
-- Powers "today's team standups" which runs on every Team page load
CREATE INDEX IF NOT EXISTS standups_org_id_date_idx
  ON standups (org_id, standup_date);

-- Composite: user + date — powers history and streak calculation
CREATE INDEX IF NOT EXISTS standups_user_id_date_idx
  ON standups (user_id, standup_date DESC);

-- Composite: org + user + date — covers dashboard stat queries
-- "did this user submit today in this org"
CREATE INDEX IF NOT EXISTS standups_org_user_date_idx
  ON standups (org_id, user_id, standup_date);
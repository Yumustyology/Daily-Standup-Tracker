-- StandupLog Database Schema
-- Fixed version: partial unique constraints use CREATE UNIQUE INDEX

-- Create organisations table
CREATE TABLE IF NOT EXISTS organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create org_members table
CREATE TABLE IF NOT EXISTS org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  invited_email text NOT NULL,
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz
);

-- FIX: Use CREATE UNIQUE INDEX instead of ALTER TABLE ADD CONSTRAINT for partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_org_member
  ON org_members (org_id, user_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_org_member
  ON org_members (org_id, invited_email)
  WHERE status = 'pending';

-- Create standups table
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

-- Add org_id column to existing standups table if not present
ALTER TABLE standups
ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id) ON DELETE CASCADE;

-- Enable Row Level Security for all tables
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE standups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organisations
DROP POLICY IF EXISTS "Organisations: Users can create organisations" ON organisations;
CREATE POLICY "Organisations: Users can create organisations"
  ON organisations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Organisations: Members can view organisations" ON organisations;
CREATE POLICY "Organisations: Members can view organisations"
  ON organisations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = organisations.id
      AND org_members.user_id = auth.uid()
      AND org_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Organisations: Creators can update organisations" ON organisations;
CREATE POLICY "Organisations: Creators can update organisations"
  ON organisations FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- RLS Policies for org_members
DROP POLICY IF EXISTS "Org Members: Active members can view their organisation's members" ON org_members;
CREATE POLICY "Org Members: Active members can view their organisation's members"
  ON org_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members AS om_self
      WHERE om_self.org_id = org_members.org_id
      AND om_self.user_id = auth.uid()
      AND om_self.status = 'active'
    )
    OR
    (org_members.invited_email = auth.email() AND org_members.status = 'pending')
  );

DROP POLICY IF EXISTS "Org Members: Active members can invite new members" ON org_members;

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

DROP POLICY IF EXISTS "Service role can insert org members" ON org_members;
CREATE POLICY "Service role can insert org members"
  ON org_members FOR INSERT TO service_role
  WITH CHECK (true);

-- RLS Policies for standups
DROP POLICY IF EXISTS "Users can view own standups" ON standups;
DROP POLICY IF EXISTS "Users can create own standups" ON standups;
DROP POLICY IF EXISTS "Users can update own standups" ON standups;
DROP POLICY IF EXISTS "Users can delete own standups" ON standups;
DROP POLICY IF EXISTS "Standups: Users can view own standups within their organisation" ON standups;
DROP POLICY IF EXISTS "Standups: Users can create own standups within their organisation" ON standups;
DROP POLICY IF EXISTS "Standups: Users can update own standups within their organisation" ON standups;
DROP POLICY IF EXISTS "Standups: Users can delete own standups within their organisation" ON standups;
DROP POLICY IF EXISTS "Standups: Active members can view all standups in their organisation" ON standups;

CREATE POLICY "Standups: Users can create own standups within their organisation"
  ON standups FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = standups.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.status = 'active'
    )
  );

CREATE POLICY "Standups: Users can update own standups within their organisation"
  ON standups FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Standups: Users can delete own standups within their organisation"
  ON standups FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Single SELECT policy covering both personal and team views
CREATE POLICY "Standups: Active members can view all standups in their organisation"
  ON standups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = standups.org_id
      AND org_members.user_id = auth.uid()
      AND org_members.status = 'active'
    )
  );

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS organisations_created_by_idx ON organisations(created_by);
CREATE INDEX IF NOT EXISTS org_members_org_id_idx ON org_members(org_id);
CREATE INDEX IF NOT EXISTS org_members_user_id_idx ON org_members(user_id);
CREATE INDEX IF NOT EXISTS org_members_invited_email_idx ON org_members(invited_email);
CREATE INDEX IF NOT EXISTS standups_user_id_idx ON standups(user_id);
CREATE INDEX IF NOT EXISTS standups_standup_date_idx ON standups(standup_date);
CREATE INDEX IF NOT EXISTS standups_created_at_idx ON standups(created_at DESC);
CREATE INDEX IF NOT EXISTS standups_org_id_idx ON standups(org_id);
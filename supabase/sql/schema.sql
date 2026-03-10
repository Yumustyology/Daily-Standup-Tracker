-- StandupLog Database Schema
-- This file contains the complete database schema for the StandupLog application
-- NOTE: This migration has already been applied via Supabase. This file is for reference.

-- Create standups table
CREATE TABLE IF NOT EXISTS standups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  yesterday text NOT NULL DEFAULT '',
  today text NOT NULL DEFAULT '',
  blockers text NOT NULL DEFAULT '',
  standup_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE standups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view their own standups
CREATE POLICY "Users can view own standups"
  ON standups
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can only create their own standups
CREATE POLICY "Users can create own standups"
  ON standups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own standups
CREATE POLICY "Users can update own standups"
  ON standups
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own standups
CREATE POLICY "Users can delete own standups"
  ON standups
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS standups_user_id_idx ON standups(user_id);
CREATE INDEX IF NOT EXISTS standups_standup_date_idx ON standups(standup_date);
CREATE INDEX IF NOT EXISTS standups_created_at_idx ON standups(created_at DESC);

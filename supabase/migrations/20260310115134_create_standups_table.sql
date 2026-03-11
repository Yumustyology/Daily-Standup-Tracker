/*
  # Create Standups Table

  1. New Tables
    - `standups`
      - `id` (uuid, primary key) - Unique identifier for each standup entry
      - `user_id` (uuid, foreign key) - References auth.users, the user who created the standup
      - `org_id` (uuid, foreign key) - References organisations, the organisation the standup belongs to
      - `yesterday` (text) - What the user did yesterday
      - `today` (text) - What the user is doing today
      - `blockers` (text) - Any blockers the user is facing
      - `standup_date` (date) - The date of the standup (for organization)
      - `created_at` (timestamptz) - When the entry was created
      - `updated_at` (timestamptz) - When the entry was last updated

  2. Security
    - Enable RLS on `standups` table
    - Add policy for users to view their own standups
    - Add policy for users to create their own standups
    - Add policy for users to update their own standups
    - Add policy for users to delete their own standups

  3. Important Notes
    - Each user can only access their own standup entries
    - The user_id is automatically set from the authenticated user
    - Timestamps are automatically managed
*/

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

ALTER TABLE standups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own standups"
  ON standups
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own standups"
  ON standups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own standups"
  ON standups
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own standups"
  ON standups
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS standups_user_id_idx ON standups(user_id);
CREATE INDEX IF NOT EXISTS standups_org_id_idx ON standups(org_id);
CREATE INDEX IF NOT EXISTS standups_standup_date_idx ON standups(standup_date);
CREATE INDEX IF NOT EXISTS standups_created_at_idx ON standups(created_at DESC);

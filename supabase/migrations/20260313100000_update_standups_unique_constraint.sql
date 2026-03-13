-- Drop the existing unique constraint
ALTER TABLE standups DROP CONSTRAINT IF EXISTS standups_user_id_standup_date_key;

-- Create a new unique constraint
ALTER TABLE standups ADD CONSTRAINT standups_user_id_org_id_standup_date_key UNIQUE (user_id, org_id, standup_date);

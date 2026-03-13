-- Part 1: Reset all user standup statistics to a clean state.
TRUNCATE TABLE public.user_standup_stats RESTART IDENTITY;

-- Part 2: Create a temporary function to reprocess all historical standups.
CREATE OR REPLACE FUNCTION public.rebuild_all_user_stats()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  standup_record public.standups%ROWTYPE;
BEGIN
  -- Loop through all standups chronologically and re-apply the stat logic.
  FOR standup_record IN
    SELECT * FROM public.standups ORDER BY created_at ASC
  LOOP
    -- For each standup, we trigger the logic as if it were a new one.
    PERFORM handle_new_standup_from_record(standup_record);
  END LOOP;
END;
$$;

-- Part 3: Create a helper function to process a single standup record.
-- This logic is extracted from the handle_new_standup trigger to be reusable.
CREATE OR REPLACE FUNCTION public.handle_new_standup_from_record(standup_record public.standups)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  stats RECORD;
  new_current_streak INT;
BEGIN
  -- Ensure a stats record exists for the user/org, creating it if it doesn't.
  INSERT INTO public.user_standup_stats (user_id, org_id, total_standups, current_streak, longest_streak, last_standup_date)
  VALUES (standup_record.user_id, standup_record.org_id, 0, 0, 0, NULL)
  ON CONFLICT (user_id, org_id) DO NOTHING;

  -- Retrieve the current stats for the user in the specific organization.
  SELECT * INTO stats FROM public.user_standup_stats
  WHERE user_id = standup_record.user_id AND org_id = standup_record.org_id
  FOR UPDATE;

  -- If this is the user's first standup in this org, initialize their stats.
  IF stats.last_standup_date IS NULL THEN
    new_current_streak := 1;
  -- If the user submitted on consecutive days, increment the streak.
  ELSIF stats.last_standup_date = standup_record.standup_date - INTERVAL '1 day' THEN
    new_current_streak := stats.current_streak + 1;
  -- If the user missed a day, reset the streak.
  ELSE
    new_current_streak := 1;
  END IF;

  -- Update the stats with the newly calculated values.
  UPDATE public.user_standup_stats
  SET
    total_standups = stats.total_standups + 1,
    current_streak = new_current_streak,
    longest_streak = GREATEST(stats.longest_streak, new_current_streak),
    last_standup_date = standup_record.standup_date
  WHERE user_id = standup_record.user_id AND org_id = standup_record.org_id;
END;
$$;

-- Part 4: Execute the rebuild function to correct all historical data.
SELECT rebuild_all_user_stats();

-- Part 5: Clean up the temporary functions.
DROP FUNCTION IF EXISTS public.rebuild_all_user_stats();
DROP FUNCTION IF EXISTS public.handle_new_standup_from_record(public.standups);

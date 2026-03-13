-- 1. Drop existing primary key and dependent objects
ALTER TABLE public.user_standup_stats DROP CONSTRAINT IF EXISTS user_standup_stats_pkey;
DROP TRIGGER IF EXISTS standup_stats_trigger ON public.standups;
DROP FUNCTION IF EXISTS public.update_user_standup_stats();

-- 2. Add composite primary key to user_standup_stats
ALTER TABLE public.user_standup_stats ADD PRIMARY KEY (user_id, org_id);

-- 3. Create a function to initialize stats when a user joins an organization
CREATE OR REPLACE FUNCTION public.create_user_standup_stats_on_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_standup_stats(user_id, org_id)
  VALUES (NEW.user_id, NEW.org_id)
  ON CONFLICT (user_id, org_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Create a trigger on org_members to call the new function
CREATE TRIGGER on_new_org_member
AFTER INSERT ON public.org_members
FOR EACH ROW
EXECUTE FUNCTION public.create_user_standup_stats_on_join();

-- 5. Recreate the function to update stats on new standups (with corrected logic)
CREATE OR REPLACE FUNCTION public.handle_new_standup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_standup_date DATE;
  prev_current_streak INT;
BEGIN
  -- Get the last standup date and streak for the user/org
  SELECT
    last_standup_date,
    current_streak
  INTO
    prev_standup_date,
    prev_current_streak
  FROM user_standup_stats
  WHERE user_id = NEW.user_id AND org_id = NEW.org_id;

  -- Update the stats
  UPDATE user_standup_stats
  SET
    total_standups = total_standups + 1,
    current_streak = CASE
      WHEN prev_standup_date = NEW.standup_date - INTERVAL '1 day' THEN current_streak + 1
      WHEN prev_standup_date = NEW.standup_date THEN current_streak
      ELSE 1
    END,
    longest_streak = GREATEST(
      longest_streak,
      CASE
        WHEN prev_standup_date = NEW.standup_date - INTERVAL '1 day' THEN current_streak + 1
        WHEN prev_standup_date = NEW.standup_date THEN current_streak
        ELSE 1
      END
    ),
    last_standup_date = NEW.standup_date
  WHERE user_id = NEW.user_id AND org_id = NEW.org_id;

  RETURN NEW;
END;
$$;

-- 6. Recreate the trigger on the standups table
CREATE TRIGGER on_new_standup
AFTER INSERT ON public.standups
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_standup();

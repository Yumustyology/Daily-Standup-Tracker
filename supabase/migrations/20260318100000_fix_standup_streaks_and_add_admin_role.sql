-- Part 1: Drop the existing trigger and function to redefine them.
DROP TRIGGER IF EXISTS on_new_standup_created ON public.standups;
DROP FUNCTION IF EXISTS public.handle_new_standup();

-- Part 2: Re-create the function to properly calculate streaks.
CREATE OR REPLACE FUNCTION public.handle_new_standup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  stats RECORD;
  new_current_streak INT;
BEGIN
  -- Ensure a stats record exists for the user/org, creating it if it doesn't.
  INSERT INTO public.user_standup_stats (user_id, org_id, total_standups, current_streak, longest_streak, last_standup_date)
  VALUES (NEW.user_id, NEW.org_id, 0, 0, 0, NULL)
  ON CONFLICT (user_id, org_id) DO NOTHING;

  -- Retrieve the current stats for the user in the specific organization.
  SELECT * INTO stats FROM public.user_standup_stats
  WHERE user_id = NEW.user_id AND org_id = NEW.org_id
  FOR UPDATE;

  -- If this is the user's first standup in this org, initialize their stats.
  IF stats.last_standup_date IS NULL THEN
    new_current_streak := 1;
  -- If the user submitted on consecutive days, increment the streak.
  ELSIF stats.last_standup_date = NEW.standup_date - INTERVAL '1 day' THEN
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
    last_standup_date = NEW.standup_date
  WHERE user_id = NEW.user_id AND org_id = NEW.org_id;

  RETURN NEW;
END;
$$;

-- Part 3: Re-create the trigger to call the updated function.
CREATE TRIGGER on_new_standup_created
  AFTER INSERT ON public.standups
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_standup();

-- Part 4: Grant admin role to the creator of a new organization.
CREATE OR REPLACE FUNCTION public.grant_admin_on_org_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert the creator of the organization as an admin.
  INSERT INTO public.org_members (org_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'admin', 'active');
  RETURN NEW;
END;
$$;

-- Part 5: Create a trigger to grant the admin role upon organization creation.
CREATE TRIGGER on_new_organization_created
  AFTER INSERT ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_on_org_creation();

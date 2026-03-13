-- Part 1: Clean up all previous stat-updating triggers and functions to prevent double counting.
DROP TRIGGER IF EXISTS standup_stats_trigger ON public.standups;
DROP FUNCTION IF EXISTS public.update_user_standup_stats();
DROP TRIGGER IF EXISTS on_new_standup ON public.standups;
DROP FUNCTION IF EXISTS public.handle_new_standup();

-- Part 2: Recreate stat-updating logic correctly, with multi-org awareness.
CREATE OR REPLACE FUNCTION public.handle_new_standup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats RECORD;
  new_current_streak INT;
BEGIN
  -- Lock the row to prevent race conditions while we update stats
  SELECT * INTO stats FROM public.user_standup_stats
  WHERE user_id = NEW.user_id AND org_id = NEW.org_id
  FOR UPDATE;

  -- This function assumes a row in user_standup_stats exists,
  -- which is created by the on_new_org_member trigger.
  -- As a fallback, if the row doesn't exist, we create it.
  IF stats IS NULL THEN
    INSERT INTO public.user_standup_stats(user_id, org_id, total_standups, current_streak, longest_streak, last_standup_date)
    VALUES (NEW.user_id, NEW.org_id, 1, 1, 1, NEW.standup_date);
    RETURN NEW;
  END IF;

  -- If the user submits a standup for a day they already submitted, do nothing.
  -- This is prevented by a unique constraint, but this is an additional safeguard.
  IF stats.last_standup_date = NEW.standup_date THEN
    RETURN NEW;
  END IF;

  -- Calculate the new streak value
  new_current_streak := CASE
    WHEN stats.last_standup_date = NEW.standup_date - INTERVAL '1 day' THEN stats.current_streak + 1
    ELSE 1
  END;

  -- Update the stats for the user/org
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

CREATE TRIGGER on_new_standup
AFTER INSERT ON public.standups
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_standup();

-- Part 3: Add admin role assignment for organization creators
CREATE OR REPLACE FUNCTION public.assign_org_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a new org is created, ensure the creator is an admin.
  INSERT INTO public.org_members (org_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'admin', 'active')
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin';

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_organisation
AFTER INSERT ON public.organisations
FOR EACH ROW
EXECUTE FUNCTION public.assign_org_creator_as_admin();

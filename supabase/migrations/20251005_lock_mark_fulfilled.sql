BEGIN;

-- 0) Helpers
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) profile_badges table and constraints/columns
CREATE TABLE IF NOT EXISTS public.profile_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  track text NOT NULL
);

-- ensure columns used by triggers exist with safe defaults
ALTER TABLE public.profile_badges
  ADD COLUMN IF NOT EXISTS "count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier integer;

UPDATE public.profile_badges
SET tier = 0
WHERE tier IS NULL;

ALTER TABLE public.profile_badges
  ALTER COLUMN tier SET DEFAULT 0,
  ALTER COLUMN tier SET NOT NULL;

-- unique key used by UPSERTs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profile_badges_profile_id_track_key'
  ) THEN
    ALTER TABLE public.profile_badges
      ADD CONSTRAINT profile_badges_profile_id_track_key
      UNIQUE (profile_id, track);
  END IF;
END$$;

-- 2) profile_stats table and constraints/columns
CREATE TABLE IF NOT EXISTS public.profile_stats (
  profile_id uuid PRIMARY KEY,
  fulfilled_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_stats
  ADD COLUMN IF NOT EXISTS fulfilled_count integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.profile_stats
SET fulfilled_count = 0
WHERE fulfilled_count IS NULL;

ALTER TABLE public.profile_stats
  ALTER COLUMN fulfilled_count SET DEFAULT 0,
  ALTER COLUMN fulfilled_count SET NOT NULL;

UPDATE public.profile_stats
SET updated_at = now()
WHERE updated_at IS NULL;

ALTER TABLE public.profile_stats
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profile_stats_profile_id_key'
  ) THEN
    ALTER TABLE public.profile_stats
      ADD CONSTRAINT profile_stats_profile_id_key UNIQUE (profile_id);
  END IF;
END$$;

-- 3) Trigger functions (final, safe versions)

-- 3a) increments counters without ON CONFLICT
CREATE OR REPLACE FUNCTION public.handle_request_fulfilled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'fulfilled'
     AND (OLD.status IS DISTINCT FROM 'fulfilled') THEN

    SELECT owner_id INTO v_owner
    FROM public.offers
    WHERE id = NEW.offer_id;

    -- Provider
    IF v_owner IS NOT NULL THEN
      UPDATE public.profile_stats
         SET fulfilled_count = fulfilled_count + 1,
             updated_at      = now()
       WHERE profile_id = v_owner;
      IF NOT FOUND THEN
        INSERT INTO public.profile_stats (profile_id, fulfilled_count, updated_at)
        VALUES (v_owner, 1, now());
      END IF;
    END IF;

    -- Requester
    UPDATE public.profile_stats
       SET fulfilled_count = fulfilled_count + 1,
           updated_at      = now()
     WHERE profile_id = NEW.requester_profile_id;
    IF NOT FOUND THEN
      INSERT INTO public.profile_stats (profile_id, fulfilled_count, updated_at)
      VALUES (NEW.requester_profile_id, 1, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3b) awards badges; uses the exact unique constraint and columns ("count", tier=0)
CREATE OR REPLACE FUNCTION public.on_request_fulfilled_award_badges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'fulfilled'
     AND (OLD.status IS DISTINCT FROM 'fulfilled') THEN

    SELECT owner_id INTO v_owner
    FROM public.offers
    WHERE id = NEW.offer_id;

    -- Provider badge
    IF v_owner IS NOT NULL THEN
      INSERT INTO public.profile_badges (profile_id, tier, track, "count")
      VALUES (v_owner, 0, 'completed_exchange', 1)
      ON CONFLICT ON CONSTRAINT profile_badges_profile_id_track_key
      DO UPDATE SET "count" = public.profile_badges."count" + EXCLUDED."count";
    END IF;

    -- Requester badge
    INSERT INTO public.profile_badges (profile_id, tier, track, "count")
    VALUES (NEW.requester_profile_id, 0, 'completed_exchange', 1)
    ON CONFLICT ON CONSTRAINT profile_badges_profile_id_track_key
    DO UPDATE SET "count" = public.profile_badges."count" + EXCLUDED."count";
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

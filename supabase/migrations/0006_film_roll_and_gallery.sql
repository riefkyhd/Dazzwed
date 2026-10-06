-- Migration 0006_film_roll_and_gallery.sql
-- Adds 6-char film roll codes, guest gallery preferences, and RPC for roll recovery

-- 1. Add guest_gallery preference to events ('off', 'anytime', 'closed')
ALTER TABLE events
ADD COLUMN IF NOT EXISTS guest_gallery text NOT NULL DEFAULT 'anytime'
CHECK (guest_gallery IN ('off', 'anytime', 'closed'));

-- 2. Add roll_code to guests (6 characters, unambiguous Crockford Base32)
ALTER TABLE guests
ADD COLUMN IF NOT EXISTS roll_code text;

-- Index for fast lookup by roll code within an event
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_event_roll_code
ON guests (event_id, roll_code)
WHERE roll_code IS NOT NULL;

-- Function to generate unambiguous 6-char roll code
-- Alphabet: 23456789ABCDEFGHJKLMNPQRSTUVWXYZ (32 chars, no 0, 1, I, O)
CREATE OR REPLACE FUNCTION generate_roll_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  res text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    res := res || substr(chars, floor(random() * 32 + 1)::int, 1);
  END LOOP;
  RETURN res;
END;
$$;

-- Trigger to assign roll_code automatically if null
CREATE OR REPLACE FUNCTION set_guest_roll_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  new_code text;
  collision int;
BEGIN
  IF NEW.roll_code IS NULL THEN
    LOOP
      new_code := generate_roll_code();
      SELECT count(*) INTO collision FROM guests WHERE event_id = NEW.event_id AND roll_code = new_code;
      IF collision = 0 THEN
        NEW.roll_code := new_code;
        EXIT;
      END IF;
    END LOOP;
  ELSE
    -- Normalize to uppercase, strip hyphens/spaces
    NEW.roll_code := upper(regexp_replace(NEW.roll_code, '[^a-zA-Z0-9]', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guest_roll_code ON guests;
CREATE TRIGGER trg_guest_roll_code
BEFORE INSERT ON guests
FOR EACH ROW
EXECUTE FUNCTION set_guest_roll_code();

-- Backfill existing guests without a roll_code
DO $$
DECLARE
  r RECORD;
  new_code text;
  collision int;
BEGIN
  FOR r IN SELECT id, event_id FROM guests WHERE roll_code IS NULL LOOP
    LOOP
      new_code := generate_roll_code();
      SELECT count(*) INTO collision FROM guests WHERE event_id = r.event_id AND roll_code = new_code;
      IF collision = 0 THEN
        UPDATE guests SET roll_code = new_code WHERE id = r.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- RPC: restore_guest_by_code
-- Allows anonymous guests to recover their session using the 6-character roll code
CREATE OR REPLACE FUNCTION restore_guest_by_code(
  p_event_slug text,
  p_roll_code text
)
RETURNS TABLE (
  guest_id uuid,
  display_name text,
  roll_code text,
  shots_per_guest int,
  shots_used bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event events%ROWTYPE;
  v_norm_code text;
  v_guest guests%ROWTYPE;
  v_used bigint;
BEGIN
  SELECT * INTO v_event FROM events WHERE slug = p_event_slug;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_norm_code := upper(regexp_replace(coalesce(p_roll_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  -- Accept common character mistypes: 0 -> O, 1 -> L
  v_norm_code := replace(replace(v_norm_code, '0', 'O'), '1', 'L');

  SELECT * INTO v_guest FROM guests
  WHERE event_id = v_event.id
    AND guests.roll_code = v_norm_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_used
  FROM photos
  WHERE photos.guest_id = v_guest.id
    AND photos.status != 'failed';

  -- Update last_seen_at
  UPDATE guests SET last_seen_at = now() WHERE id = v_guest.id;

  RETURN QUERY
  SELECT
    v_guest.id AS guest_id,
    v_guest.display_name,
    v_guest.roll_code,
    v_event.shots_per_guest,
    v_used AS shots_used;
END;
$$;

-- Grant execution to authenticated & service_role (invoked via supabaseAdmin / service role)
REVOKE ALL ON FUNCTION restore_guest_by_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION restore_guest_by_code(text, text) TO service_role;

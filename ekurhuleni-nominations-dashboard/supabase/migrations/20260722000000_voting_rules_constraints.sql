-- Migration: 20260722000000_voting_rules_constraints.sql
-- Applies the authoritative voting rules documented in docs/voting-rules.md.
--   Rule 1: Each branch (ward) has at most 6 votes total.
--   Rule 2: vote_count per (ward_id, candidate_id) row is 0 or 1 — binary only.
--   Write path: replace_ward_nominations() RPC for atomic full-replace per ward.

-- ---------------------------------------------------------------------------
-- 1. Cap any existing vote_count > 1 down to 1 so the table can accept the
--    new binary CHECK without failing on legacy data.
-- ---------------------------------------------------------------------------
UPDATE nominations
SET vote_count = 1, updated_at = CURRENT_TIMESTAMP
WHERE vote_count > 1;

-- ---------------------------------------------------------------------------
-- 2. Add binary CHECK constraint on vote_count.
-- ---------------------------------------------------------------------------
ALTER TABLE nominations
  DROP CONSTRAINT IF EXISTS nominations_vote_count_binary;

ALTER TABLE nominations
  ADD CONSTRAINT nominations_vote_count_binary
  CHECK (vote_count IN (0, 1));

-- ---------------------------------------------------------------------------
-- 3. Trigger function: enforce maximum 6 votes per ward after any insert or
--    update on nominations. Raises an exception if the ward total exceeds 6.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_ward_vote_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ward_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(vote_count), 0)
  INTO ward_total
  FROM nominations
  WHERE ward_id = NEW.ward_id;

  IF ward_total > 6 THEN
    RAISE EXCEPTION
      'Ward % would have % total votes after this change; maximum is 6.',
      NEW.ward_id,
      ward_total
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger (drop first for idempotency).
DROP TRIGGER IF EXISTS trg_enforce_ward_vote_total ON nominations;

CREATE TRIGGER trg_enforce_ward_vote_total
  AFTER INSERT OR UPDATE ON nominations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_ward_vote_total();

-- ---------------------------------------------------------------------------
-- 4. RPC: replace_ward_nominations
--    Atomically deletes all nomination rows for p_ward_id and reinserts one
--    row per candidate in p_candidate_ids with vote_count = 1.
--    Called by the nominations Netlify function for both bulk upload and
--    manual capture. Returns the count of inserted rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION replace_ward_nominations(
  p_ward_id      UUID,
  p_candidate_ids UUID[],
  p_batch_id     UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_cid      UUID;
BEGIN
  -- Validate ward exists.
  IF NOT EXISTS (SELECT 1 FROM wards WHERE id = p_ward_id) THEN
    RAISE EXCEPTION 'Ward % does not exist.', p_ward_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Validate candidate count.
  IF array_length(p_candidate_ids, 1) > 6 THEN
    RAISE EXCEPTION 'Cannot cast more than 6 votes per ward; % candidates provided.',
      array_length(p_candidate_ids, 1)
      USING ERRCODE = 'check_violation';
  END IF;

  -- Full replace: delete then insert.
  DELETE FROM nominations WHERE ward_id = p_ward_id;

  IF p_candidate_ids IS NOT NULL AND array_length(p_candidate_ids, 1) > 0 THEN
    FOREACH v_cid IN ARRAY p_candidate_ids LOOP
      INSERT INTO nominations (ward_id, candidate_id, vote_count, nomination_date, batch_id)
      VALUES (p_ward_id, v_cid, 1, CURRENT_DATE, p_batch_id);
      v_inserted := v_inserted + 1;
    END LOOP;
  END IF;

  RETURN v_inserted;
END;
$$;

-- Grant execute to authenticated users (server-side function is called via
-- the service-role key in the Netlify function, but the grant keeps options open).
GRANT EXECUTE ON FUNCTION replace_ward_nominations(UUID, UUID[], UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS — add INSERT/UPDATE/DELETE policies for authenticated users so that
--    the service-role bypass in the Netlify function continues to work, and
--    non-service calls via the RPC are also authorised.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE POLICY nominations_insert_authenticated ON nominations
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY nominations_update_authenticated ON nominations
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY nominations_delete_authenticated ON nominations
    FOR DELETE TO authenticated USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT INSERT, UPDATE, DELETE ON TABLE nominations TO authenticated;

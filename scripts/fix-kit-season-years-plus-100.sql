-- =============================================================================
-- Fix kits where season data was off by +100 (wrong century in source data).
-- Run in Supabase → SQL Editor in order: helper function → previews → updates → verify.
--
-- If you already fixed numeric columns earlier, skip Part A and run from section 0 + Part B.
--
-- Part A: season_start_year, season_end_year (numeric columns >= 2049 → minus 100)
-- Part B: season_label (text containing 2049–2099 as digits → minus 100 per occurrence)
--        Safe for 2020–2048: those substrings are not replaced.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Helper for Part B (create once; used by preview + UPDATE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fix_season_label_minus_100(t text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text;
  y int;
BEGIN
  IF t IS NULL THEN
    RETURN NULL;
  END IF;

  result := t;
  FOR y IN REVERSE 2099..2049 LOOP
    result := replace(result, y::text, (y - 100)::text);
  END LOOP;

  RETURN result;
END;
$$;

-- ############################################################################
-- PART A — Numeric years
-- ############################################################################

-- A1) COUNT
SELECT COUNT(*) AS kits_with_bad_numeric_years
FROM public.kits
WHERE season_start_year >= 2049
   OR season_end_year >= 2049;

-- A2) PREVIEW
SELECT
  id,
  title,
  season_label,
  season_start_year,
  season_end_year,
  season_start_year - 100 AS suggested_start,
  season_end_year - 100 AS suggested_end
FROM public.kits
WHERE season_start_year >= 2049
   OR season_end_year >= 2049
ORDER BY id;

-- A3) APPLY numeric fix
BEGIN;

UPDATE public.kits
SET
  season_start_year = CASE
    WHEN season_start_year >= 2049 THEN season_start_year - 100
    ELSE season_start_year
  END,
  season_end_year = CASE
    WHEN season_end_year >= 2049 THEN season_end_year - 100
    ELSE season_end_year
  END
WHERE season_start_year >= 2049
   OR season_end_year >= 2049;

COMMIT;

-- A4) VERIFY numeric (expect 0 rows)
SELECT id, title, season_start_year, season_end_year
FROM public.kits
WHERE season_start_year >= 2049
   OR season_end_year >= 2049;

-- ############################################################################
-- PART B — season_label text (e.g. 2099-00 → 1999-00)
-- ############################################################################

-- B1) COUNT
SELECT COUNT(*) AS labels_still_containing_bad_years
FROM public.kits
WHERE season_label IS NOT NULL
  AND season_label ~ '20(4[9]|[5-9][0-9])';

-- B2) PREVIEW
SELECT
  id,
  title,
  season_label AS current_label,
  public.fix_season_label_minus_100(season_label) AS fixed_label
FROM public.kits
WHERE season_label IS NOT NULL
  AND season_label ~ '20(4[9]|[5-9][0-9])'
ORDER BY id;

-- B3) APPLY label fix
BEGIN;

UPDATE public.kits
SET season_label = public.fix_season_label_minus_100(season_label)
WHERE season_label IS NOT NULL
  AND season_label ~ '20(4[9]|[5-9][0-9])';

COMMIT;

-- B4) VERIFY labels (expect 0 rows)
SELECT id, title, season_label
FROM public.kits
WHERE season_label IS NOT NULL
  AND season_label ~ '20(4[9]|[5-9][0-9])';

-- ---------------------------------------------------------------------------
-- Optional: drop helper when everything looks good
-- ---------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.fix_season_label_minus_100(text);

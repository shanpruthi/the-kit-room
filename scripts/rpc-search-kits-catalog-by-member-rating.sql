-- Default Find catalog order: kits with member ratings first (highest average first),
-- then kits with no ratings. Uses same “has primary image” eligibility as typical client queries.
--
-- Run once in Supabase → SQL Editor (postgres role). Then `search_kits_catalog_by_member_rating`
-- is callable from the app when `sort=member_rating` with no search/filters.

CREATE OR REPLACE FUNCTION public.search_kits_catalog_by_member_rating(
  page_limit integer,
  page_offset integer
)
RETURNS TABLE(kit_id bigint, total_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH eligible AS (
    SELECT k.id
    FROM public.kits k
    WHERE k.primary_object_url IS NOT NULL
       OR k.primary_image_url IS NOT NULL
  ),
  rated AS (
    SELECT u.kit_id::bigint AS kit_id,
           AVG(u.rating::double precision) AS avg_r
    FROM public.user_kit_states u
    WHERE u.rating IS NOT NULL
      AND u.rating > 0
    GROUP BY u.kit_id
  )
  SELECT
    e.id::bigint AS kit_id,
    (SELECT COUNT(*)::bigint FROM eligible) AS total_count
  FROM eligible e
  LEFT JOIN rated r ON r.kit_id = e.id::bigint
  ORDER BY
    (r.kit_id IS NOT NULL) DESC,
    r.avg_r DESC NULLS LAST,
    e.id ASC
  LIMIT page_limit
  OFFSET page_offset;
$$;

GRANT EXECUTE ON FUNCTION public.search_kits_catalog_by_member_rating(integer, integer)
  TO anon, authenticated, service_role;

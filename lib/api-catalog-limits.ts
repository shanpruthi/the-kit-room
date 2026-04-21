/**
 * Bounds for unauthenticated `/api/kits` usage (abuse / accidental huge queries).
 * Aligned with app usage: Find uses 150 per page (`FIND_PAGE_SIZE`).
 */
export const MAX_CATALOG_PAGE_LIMIT = 150
export const MAX_CATALOG_OFFSET = 500_000
/** Max values per facet (decade, brand, kitType, color) from query string. */
export const MAX_FILTER_VALUES_PER_KEY = 80
/** Max kit ids per POST body (profile saved list + headroom). */
export const MAX_KITS_BY_IDS_PER_REQUEST = 2000

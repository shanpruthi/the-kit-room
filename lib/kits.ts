import { INITIAL_FIND_CATALOG_LIMIT } from "@/lib/api-catalog-limits"
import { supabase } from "@/lib/supabase"
import type { CatalogKit, CatalogPage, CatalogSummary, CatalogSearchParams } from "@/lib/types"

type RawKitRow = {
  id: number
  title: string
  season_label: string | null
  season_start_year: number | null
  season_end_year: number | null
  kit_type: string | null
  variant_name: string | null
  sponsor_name: string | null
  description: string | null
  community_rating_avg: number | string | null
  community_rating_count: number | null
  primary_image_url: string | null
  primary_object_url: string | null
  source_url: string | null
  team: {
    name: string | null
    country_name: string | null
    team_type: string | null
  } | null
  brand: {
    name: string | null
  } | null
  kit_colors:
    | {
        color_name: string | null
        hex_code: string | null
        sort_order: number | null
      }[]
    | null
  kit_images:
    | {
        object_url: string | null
        source_url: string | null
        is_primary: boolean | null
        sort_order: number | null
      }[]
    | null
  kit_competitions:
    | {
        outcome: string | null
        sort_order: number | null
        competition:
          | {
              name: string | null
            }
          | {
              name: string | null
            }[]
          | null
      }[]
    | null
}

type SearchKitRow = {
  kit_id: number
  total_count: number
}

type CatalogSummaryRow = {
  kits_count: number
  teams_count: number
  decades: string[] | null
  brands: string[] | null
  kit_types: string[] | null
}

const KIT_SELECT = `
  id,
  title,
  season_label,
  season_start_year,
  season_end_year,
  kit_type,
  variant_name,
  sponsor_name,
  description,
  community_rating_avg,
  community_rating_count,
  primary_image_url,
  primary_object_url,
  source_url,
  team:teams!kits_team_id_fkey (
    name,
    country_name,
    team_type
  ),
  brand:brands!kits_brand_id_fkey (
    name
  ),
  kit_colors (
    color_name,
    hex_code,
    sort_order
  ),
  kit_images (
    object_url,
    source_url,
    is_primary,
    sort_order
  ),
  kit_competitions (
    outcome,
    sort_order,
    competition:competitions (
      name
    )
  )
`

const colorFallbacks: Record<string, string> = {
  red: "#b6382a",
  white: "#f6f1e7",
  black: "#1d1c1a",
  blue: "#2658b3",
  navy: "#1f325f",
  yellow: "#ebc13d",
  green: "#327b53",
  gold: "#ba9448",
  orange: "#da6a2f",
  purple: "#6d4bb7",
  claret: "#7c2335",
  sky: "#7cb8eb",
  grey: "#8d8a84",
}

function firstNonEmptyUrl(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue
    }

    const trimmed = candidate.trim()

    if (trimmed.length > 0) {
      return trimmed
    }
  }

  return null
}

function normalizeHex(name: string | null, hex: string | null) {
  if (hex) {
    return hex
  }

  if (!name) {
    return null
  }

  const normalized = name.toLowerCase()

  const match = Object.entries(colorFallbacks).find(([key]) =>
    normalized.includes(key),
  )

  return match?.[1] ?? null
}

function firstCompetitionName(
  competition:
    | {
        name: string | null
      }
    | {
        name: string | null
      }[]
    | null,
) {
  if (!competition) {
    return null
  }

  if (Array.isArray(competition)) {
    return competition[0]?.name ?? null
  }

  return competition.name
}

function mapCatalogKit(kit: RawKitRow): CatalogKit {
  const orderedColors = [...(kit.kit_colors ?? [])].sort(
    (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0),
  )

  const orderedImages = [...(kit.kit_images ?? [])].sort((left, right) => {
    if (left.is_primary && !right.is_primary) {
      return -1
    }

    if (!left.is_primary && right.is_primary) {
      return 1
    }

    return (left.sort_order ?? 0) - (right.sort_order ?? 0)
  })

  const orderedCompetitions = [...(kit.kit_competitions ?? [])].sort(
    (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0),
  )

  let galleryUrl: string | null = null

  for (const image of orderedImages) {
    galleryUrl = firstNonEmptyUrl(image.object_url, image.source_url)

    if (galleryUrl) {
      break
    }
  }

  return {
    id: kit.id,
    title: kit.title,
    teamName: kit.team?.name ?? "Unknown Team",
    teamCountry: kit.team?.country_name ?? "Unknown Country",
    teamType: kit.team?.team_type ?? "club",
    brandName: kit.brand?.name ?? "Independent",
    seasonLabel: kit.season_label ?? "Unknown Season",
    seasonStartYear: kit.season_start_year,
    seasonEndYear: kit.season_end_year,
    kitType: kit.kit_type ?? "unknown",
    variantName: kit.variant_name,
    sponsorName: kit.sponsor_name,
    description: kit.description,
    ratingAverage: Number(kit.community_rating_avg ?? 0),
    ratingCount: kit.community_rating_count ?? 0,
    imageUrl: firstNonEmptyUrl(
      kit.primary_object_url,
      kit.primary_image_url,
      galleryUrl,
    ),
    sourceUrl: kit.source_url,
    colors: orderedColors.map((color) => ({
      name: color.color_name ?? "Unknown",
      hex: normalizeHex(color.color_name, color.hex_code),
    })),
    competitions: orderedCompetitions
      .map((competition) => ({
        name: firstCompetitionName(competition.competition) ?? "Competition",
        outcome: competition.outcome,
      }))
      .filter((competition) => Boolean(competition.name)),
  }
}

function hasCatalogImage(kit: CatalogKit) {
  return Boolean(kit.imageUrl)
}

export async function getKitsByIds(ids: number[]): Promise<CatalogKit[]> {
  if (ids.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from("kits")
    .select(KIT_SELECT)
    .in("id", ids)
    .returns<RawKitRow[]>()

  if (error) {
    throw new Error(`Failed to load kits by id: ${error.message}`)
  }

  const kits = (data ?? []).map(mapCatalogKit).filter(hasCatalogImage)
  const kitOrder = new Map(ids.map((id, index) => [id, index]))

  return kits.sort((left, right) => {
    return (kitOrder.get(left.id) ?? 0) - (kitOrder.get(right.id) ?? 0)
  })
}

function isDefaultUnfilteredCatalogQuery(params: CatalogSearchParams) {
  return (
    !params.query?.trim() &&
    params.decades.length === 0 &&
    params.brands.length === 0 &&
    params.kitTypes.length === 0 &&
    params.colors.length === 0
  )
}

export async function searchKitCatalog(
  params: CatalogSearchParams,
): Promise<CatalogPage> {
  const useMemberRatingSort =
    Boolean(params.sortByMemberRating) && isDefaultUnfilteredCatalogQuery(params)

  if (useMemberRatingSort) {
    const { data, error } = await supabase.rpc("search_kits_catalog_by_member_rating", {
      page_limit: params.limit,
      page_offset: params.offset,
    })

    if (error) {
      return searchKitCatalog({
        ...params,
        sortByMemberRating: false,
      })
    }

    const rows = (data ?? []) as SearchKitRow[]
    const ids = rows.map((row) => row.kit_id)
    const kits = await getKitsByIds(ids)
    const totalCount = Number(rows[0]?.total_count ?? 0)

    return {
      kits,
      totalCount,
      limit: params.limit,
      offset: params.offset,
      hasMore: params.offset + kits.length < totalCount,
    }
  }

  const { data, error } = await supabase.rpc("search_kits_catalog", {
    search_query: params.query || null,
    decades: params.decades.length ? params.decades : null,
    brands: params.brands.length ? params.brands : null,
    kit_types: params.kitTypes.length
      ? params.kitTypes.map((kitType) => kitType.toLowerCase())
      : null,
    colors: params.colors.length ? params.colors : null,
    page_limit: params.limit,
    page_offset: params.offset,
  })

  if (error) {
    throw new Error(`Failed to search kit catalog: ${error.message}`)
  }

  const rows = (data ?? []) as SearchKitRow[]
  const ids = rows.map((row) => row.kit_id)
  const kits = await getKitsByIds(ids)
  const totalCount = rows[0]?.total_count ?? 0

  return {
    kits,
    totalCount,
    limit: params.limit,
    offset: params.offset,
    hasMore: params.offset + kits.length < totalCount,
  }
}

export async function getCatalogSummary(): Promise<CatalogSummary> {
  const { data, error } = await supabase
    .rpc("get_kit_catalog_summary")
    .single()

  if (error) {
    throw new Error(`Failed to load catalog summary: ${error.message}`)
  }

  const row = data as CatalogSummaryRow

  return {
    kitsCount: row.kits_count,
    teamsCount: row.teams_count,
    decades: row.decades ?? [],
    brands: row.brands ?? [],
    kitTypes: row.kit_types ?? [],
  }
}

export async function getInitialFindCatalogPage(): Promise<CatalogPage> {
  return searchKitCatalog({
    query: "",
    decades: [],
    brands: [],
    kitTypes: [],
    colors: [],
    limit: INITIAL_FIND_CATALOG_LIMIT,
    offset: 0,
    sortByMemberRating: true,
  })
}

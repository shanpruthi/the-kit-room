import { supabase } from "@/lib/supabase"
import { getSupabaseServiceRoleClient } from "@/lib/supabase-service"

type TrendKitRow = {
  id: number
  season_start_year: number | null
  primary_image_url: string | null
  primary_object_url: string | null
  team: {
    name: string | null
    team_type: string | null
  } | null
  brand: {
    name: string | null
  } | null
}

export type TrendsPageData = {
  summary: {
    ratedKitsCount: number
    averageRating: number
    topBrand: string
    topDecade: string
  }
  averageRatingByDecade: {
    decade: string
    averageRating: number
    ratedKitsCount: number
  }[]
  topBrandsByAverageRating: {
    brand: string
    averageRating: number
    ratedKitsCount: number
  }[]
  topClubsByAverageRating: {
    club: string
    averageRating: number
    ratedKitsCount: number
  }[]
  brandShareByDecade: {
    decade: string
    totalKits: number
    shares: {
      brand: string
      count: number
      share: number
      color: string
    }[]
  }[]
}

type Aggregate = {
  totalRating: number
  ratedKitsCount: number
}

const PAGE_SIZE = 2000
const BRAND_COLORS = ["#111111", "#4b5563", "#9ca3af", "#d1d5db", "#e5e7eb"]

function formatDecade(year: number) {
  const decadeStart = Math.floor(year / 10) * 10
  return `${decadeStart}-${decadeStart + 9}`
}

function normalizeBrand(brand: string | null) {
  return brand?.trim() || "Independent"
}

function normalizeTeamName(teamName: string | null) {
  return teamName?.trim() || "Unknown Team"
}

function addAggregate(map: Map<string, Aggregate>, key: string, rating: number) {
  const current = map.get(key) ?? { totalRating: 0, ratedKitsCount: 0 }
  current.totalRating += rating
  current.ratedKitsCount += 1
  map.set(key, current)
}

/**
 * Trends must use the service role so every `user_kit_states` row is visible.
 * The anon client runs without a user session on the server and only sees what
 * RLS allows — often a handful of rows or none, which makes charts look “stuck”
 * even when `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel (e.g. before redeploy).
 */
function getServiceClientForTrendsRatings() {
  const client = getSupabaseServiceRoleClient()
  if (!client) {
    throw new Error(
      "Trends cannot load member ratings: set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL on the server, then redeploy. " +
        "Without the service role, aggregates only reflect what anonymous RLS allows (usually wrong).",
    )
  }
  return client
}

/** Sum and count of every member rating row, grouped by kit (ground truth for kit averages). */
async function loadUserRatingAggregatesByKitId(): Promise<
  Map<number, { sum: number; count: number }>
> {
  const db = getServiceClientForTrendsRatings()
  const agg = new Map<number, { sum: number; count: number }>()
  let offset = 0

  while (true) {
    const { data, error } = await db
      .from("user_kit_states")
      .select("kit_id, rating")
      .not("rating", "is", null)
      .gt("rating", 0)
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Failed to load member ratings for trends: ${error.message}`)
    }

    const page = data ?? []
    for (const row of page) {
      const kitId = Number(row.kit_id)
      const r = Number(row.rating)
      if (!Number.isFinite(kitId) || !Number.isFinite(r) || r <= 0) {
        continue
      }

      const current = agg.get(kitId) ?? { sum: 0, count: 0 }
      current.sum += r
      current.count += 1
      agg.set(kitId, current)
    }

    if (page.length < PAGE_SIZE) {
      break
    }

    offset += PAGE_SIZE
  }

  return agg
}

/** Mean of `user_kit_states.rating` rows for this kit — the only source for trend scores. */
function kitRatingFromUserInput(
  kitId: number,
  userRatingsByKit: Map<number, { sum: number; count: number }>,
): number | null {
  const agg = userRatingsByKit.get(kitId)
  if (!agg || agg.count < 1) {
    return null
  }

  return agg.sum / agg.count
}

const KIT_SELECT = `
  id,
  season_start_year,
  primary_image_url,
  primary_object_url,
  team:teams!kits_team_id_fkey (
    name,
    team_type
  ),
  brand:brands!kits_brand_id_fkey (
    name
  )
`

/** Kits with a display image — used to keep the main trends scan bounded. */
async function getAllTrendRows() {
  const rows: TrendKitRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from("kits")
      .select(KIT_SELECT)
      .or("primary_object_url.not.is.null,primary_image_url.not.is.null")
      .range(offset, offset + PAGE_SIZE - 1)
      .returns<TrendKitRow[]>()

    if (error) {
      throw new Error(`Failed to load trends data: ${error.message}`)
    }

    const page = data ?? []
    rows.push(...page)

    if (page.length < PAGE_SIZE) {
      break
    }

    offset += PAGE_SIZE
  }

  return rows
}

const IDS_PER_QUERY = 120

/** Catalog rows for specific kit ids (no image filter) so rated kits still count in Trends. */
async function fetchTrendKitRowsByIds(ids: number[]): Promise<TrendKitRow[]> {
  if (ids.length === 0) {
    return []
  }

  const db = getSupabaseServiceRoleClient() ?? supabase
  const out: TrendKitRow[] = []

  for (let i = 0; i < ids.length; i += IDS_PER_QUERY) {
    const chunk = ids.slice(i, i + IDS_PER_QUERY)
    const { data, error } = await db
      .from("kits")
      .select(KIT_SELECT)
      .in("id", chunk)
      .returns<TrendKitRow[]>()

    if (error) {
      throw new Error(`Failed to load kits by id for trends: ${error.message}`)
    }

    out.push(...(data ?? []))
  }

  return out
}

function mergeTrendRowsById(primary: TrendKitRow[], extra: TrendKitRow[]): TrendKitRow[] {
  const map = new Map<number, TrendKitRow>()
  for (const row of primary) {
    map.set(row.id, row)
  }
  for (const row of extra) {
    map.set(row.id, row)
  }
  return [...map.values()]
}

export async function getTrendsPageData(): Promise<TrendsPageData> {
  const [rowsWithImages, userRatingsByKit] = await Promise.all([
    getAllTrendRows(),
    loadUserRatingAggregatesByKitId(),
  ])

  const ratedKitIds = [...userRatingsByKit.keys()]
  const haveImage = new Set(rowsWithImages.map((row) => row.id))
  const missingRatedIds = ratedKitIds.filter((id) => !haveImage.has(id))
  const extraRows = await fetchTrendKitRowsByIds(missingRatedIds)
  const rows = mergeTrendRowsById(rowsWithImages, extraRows)

  const decadeRatings = new Map<string, Aggregate>()
  const brandRatings = new Map<string, Aggregate>()
  const clubRatings = new Map<string, Aggregate>()
  const brandVolume = new Map<string, number>()
  const brandDecadeVolume = new Map<string, Map<string, number>>()
  const decadeTotals = new Map<string, number>()

  rows.forEach((row) => {
    const brand = normalizeBrand(row.brand?.name ?? null)
    const teamName = normalizeTeamName(row.team?.name ?? null)
    const teamType = row.team?.team_type?.trim().toLowerCase() ?? "club"

    const rating = kitRatingFromUserInput(row.id, userRatingsByKit)
    const decade =
      row.season_start_year !== null ? formatDecade(row.season_start_year) : null

    if (rating !== null) {
      brandVolume.set(brand, (brandVolume.get(brand) ?? 0) + 1)

      if (decade) {
        decadeTotals.set(decade, (decadeTotals.get(decade) ?? 0) + 1)
        const decadeMap = brandDecadeVolume.get(decade) ?? new Map<string, number>()
        decadeMap.set(brand, (decadeMap.get(brand) ?? 0) + 1)
        brandDecadeVolume.set(decade, decadeMap)
      }
    }

    if (rating === null) {
      return
    }

    addAggregate(brandRatings, brand, rating)
    if (teamType === "club") {
      addAggregate(clubRatings, teamName, rating)
    }

    if (decade) {
      addAggregate(decadeRatings, decade, rating)
    }
  })

  const ratedKitsCount = userRatingsByKit.size
  let totalRatingSum = 0
  for (const kitId of userRatingsByKit.keys()) {
    const mean = kitRatingFromUserInput(kitId, userRatingsByKit)
    if (mean !== null) {
      totalRatingSum += mean
    }
  }

  const averageRatingByDecade = Array.from(decadeRatings.entries())
    .map(([decade, aggregate]) => ({
      decade,
      averageRating: aggregate.totalRating / aggregate.ratedKitsCount,
      ratedKitsCount: aggregate.ratedKitsCount,
    }))
    .sort((left, right) => left.decade.localeCompare(right.decade))

  const topBrandsByAverageRating = Array.from(brandRatings.entries())
    .map(([brand, aggregate]) => ({
      brand,
      averageRating: aggregate.totalRating / aggregate.ratedKitsCount,
      ratedKitsCount: aggregate.ratedKitsCount,
    }))
    .sort((left, right) => {
      if (right.averageRating !== left.averageRating) {
        return right.averageRating - left.averageRating
      }

      return right.ratedKitsCount - left.ratedKitsCount
    })
    .slice(0, 10)

  const topClubsByAverageRating = Array.from(clubRatings.entries())
    .map(([club, aggregate]) => ({
      club,
      averageRating: aggregate.totalRating / aggregate.ratedKitsCount,
      ratedKitsCount: aggregate.ratedKitsCount,
    }))
    .sort((left, right) => {
      if (right.averageRating !== left.averageRating) {
        return right.averageRating - left.averageRating
      }

      return right.ratedKitsCount - left.ratedKitsCount
    })
    .slice(0, 10)

  const leadingBrands = Array.from(brandVolume.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([brand]) => brand)

  const brandShareByDecade = Array.from(decadeTotals.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([decade, totalKits]) => {
      const decadeMap = brandDecadeVolume.get(decade) ?? new Map<string, number>()

      return {
        decade,
        totalKits,
        shares: leadingBrands.map((brand) => {
          const count = decadeMap.get(brand) ?? 0
          return {
            brand,
            count,
            share: totalKits > 0 ? count / totalKits : 0,
          }
        }),
      }
    })

  const topBrand = topBrandsByAverageRating[0]?.brand ?? "Independent"
  const topDecade =
    [...averageRatingByDecade].sort(
      (left, right) => right.averageRating - left.averageRating,
    )[0]?.decade ?? "Unknown"

  return {
    summary: {
      ratedKitsCount,
      averageRating: ratedKitsCount ? totalRatingSum / ratedKitsCount : 0,
      topBrand,
      topDecade,
    },
    averageRatingByDecade,
    topBrandsByAverageRating,
    topClubsByAverageRating,
    brandShareByDecade: brandShareByDecade.map((entry) => ({
      ...entry,
      shares: entry.shares.map((share, index) => ({
        ...share,
        color: BRAND_COLORS[index] ?? "#111111",
      })),
    })),
  }
}

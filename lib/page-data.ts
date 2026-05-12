import { unstable_cache } from "next/cache"
import {
  getCatalogSummary,
  getExploreKitCatalog,
  getInitialFindCatalogPage,
} from "@/lib/kits"
import type { CatalogPage, CatalogSummary } from "@/lib/types"

const EMPTY_FIND_PAGE: CatalogPage = {
  kits: [],
  totalCount: 0,
  limit: 48,
  offset: 0,
  hasMore: false,
}

const EMPTY_SUMMARY: CatalogSummary = {
  kitsCount: 0,
  teamsCount: 0,
  decades: [],
  brands: [],
  kitTypes: [],
}

function buildFallbackSummary(initialFindPage: CatalogPage): CatalogSummary {
  return {
    kitsCount: initialFindPage.totalCount,
    teamsCount: new Set(initialFindPage.kits.map((kit) => kit.teamName)).size,
    decades: Array.from(
      new Set(
        initialFindPage.kits
          .filter((kit) => kit.seasonStartYear !== null)
          .map((kit) => {
            const decadeStart = Math.floor((kit.seasonStartYear ?? 0) / 10) * 10
            return `${decadeStart}-${decadeStart + 9}`
          }),
      ),
    ).sort(),
    brands: Array.from(new Set(initialFindPage.kits.map((kit) => kit.brandName))).sort(),
    kitTypes: Array.from(
      new Set(
        initialFindPage.kits.map((kit) =>
          kit.kitType.charAt(0).toUpperCase() + kit.kitType.slice(1),
        ),
      ),
    ).sort(),
  }
}

async function fetchKitRoomShellData() {
  let initialFindPage = EMPTY_FIND_PAGE

  try {
    initialFindPage = await getInitialFindCatalogPage()
  } catch {
    return {
      initialFindPage: EMPTY_FIND_PAGE,
      summary: EMPTY_SUMMARY,
      exploreKits: [],
      summaryNeedsRefresh: true,
    }
  }
  const [summaryResult, exploreResult] = await Promise.allSettled([
    getCatalogSummary(),
    getExploreKitCatalog(),
  ])

  const summary =
    summaryResult.status === "fulfilled"
      ? summaryResult.value
      : buildFallbackSummary(initialFindPage)

  /** Never fall back to Find kits — Explore only lists rows with validated image URLs. */
  const exploreKits =
    exploreResult.status === "fulfilled" ? exploreResult.value : []

  const summaryNeedsRefresh = summaryResult.status !== "fulfilled"

  return {
    initialFindPage,
    summary,
    exploreKits,
    summaryNeedsRefresh,
  }
}

/** Cached catalog payload so revisiting `/` does not re-hit Supabase on every navigation. */
const getCachedKitRoomShellData = unstable_cache(fetchKitRoomShellData, ["kit-room-shell"], {
  revalidate: 300,
})

/**
 * In development (`next dev`, e.g. localhost:3000), skip the data cache so the Find grid
 * matches live RPC results and API responses. Production keeps the cached payload.
 */
export async function getKitRoomShellData() {
  if (process.env.NODE_ENV === "development") {
    return fetchKitRoomShellData()
  }

  return getCachedKitRoomShellData()
}

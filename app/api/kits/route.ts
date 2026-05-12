import { NextResponse } from "next/server"
import {
  INITIAL_FIND_CATALOG_LIMIT,
  MAX_CATALOG_OFFSET,
  MAX_CATALOG_PAGE_LIMIT,
  MAX_FILTER_VALUES_PER_KEY,
  MAX_KITS_BY_IDS_PER_REQUEST,
} from "@/lib/api-catalog-limits"
import { getKitsByIds, searchKitCatalog } from "@/lib/kits"

const RESTRICTED_PROJECT_MESSAGE =
  "Failed to search kit catalog: Service for this project is restricted."

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.min(Math.max(Math.trunc(value), min), max)
}

function takeFacets(values: string[]) {
  return values
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, MAX_FILTER_VALUES_PER_KEY)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitValue = Number.parseInt(
    searchParams.get("limit") ?? String(INITIAL_FIND_CATALOG_LIMIT),
    10,
  )
  const offsetValue = Number.parseInt(searchParams.get("offset") ?? "0", 10)

  const limit = clampInt(limitValue, 1, MAX_CATALOG_PAGE_LIMIT, MAX_CATALOG_PAGE_LIMIT)
  const offset = clampInt(offsetValue, 0, MAX_CATALOG_OFFSET, 0)

  try {
    const sort = searchParams.get("sort")?.trim().toLowerCase()
    const page = await searchKitCatalog({
      query: searchParams.get("q")?.trim() ?? "",
      decades: takeFacets(searchParams.getAll("decade")),
      brands: takeFacets(searchParams.getAll("brand")),
      kitTypes: takeFacets(searchParams.getAll("kitType")),
      colors: takeFacets(searchParams.getAll("color")),
      limit,
      offset,
      sortByMemberRating: sort === "member_rating",
    })

    return NextResponse.json(page)
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Failed to load catalog page."
    const message = rawMessage.toLowerCase().includes("service for this project is restricted")
      ? RESTRICTED_PROJECT_MESSAGE
      : rawMessage

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function dedupeKitIds(ids: number[], max: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const id of ids) {
    if (!Number.isFinite(id)) {
      continue
    }
    const n = Math.trunc(id)
    if (seen.has(n)) {
      continue
    }
    seen.add(n)
    out.push(n)
    if (out.length >= max) {
      break
    }
  }
  return out
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { ids?: unknown }
    const raw = Array.isArray(body.ids) ? body.ids : []
    const numeric = raw
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
    const ids = dedupeKitIds(numeric, MAX_KITS_BY_IDS_PER_REQUEST)

    const kits = await getKitsByIds(ids)

    return NextResponse.json({ kits })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const message =
      error instanceof Error ? error.message : "Failed to load kit details."

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

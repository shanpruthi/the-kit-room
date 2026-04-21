export type TeamType = "club" | "national" | string

export interface CatalogColor {
  name: string
  hex: string | null
}

export interface CatalogCompetition {
  name: string
  outcome: string | null
}

export interface CatalogKit {
  id: number
  title: string
  teamName: string
  teamCountry: string
  teamType: TeamType
  brandName: string
  seasonLabel: string
  seasonStartYear: number | null
  seasonEndYear: number | null
  kitType: string
  variantName: string | null
  sponsorName: string | null
  description: string | null
  ratingAverage: number
  ratingCount: number
  imageUrl: string | null
  sourceUrl: string | null
  colors: CatalogColor[]
  competitions: CatalogCompetition[]
}

export interface UserKitState {
  owned: boolean
  wanted: boolean
  rating: number | null
}

export interface CatalogSearchParams {
  query: string
  decades: string[]
  brands: string[]
  kitTypes: string[]
  colors: string[]
  limit: number
  offset: number
  /**
   * When true with no query/facets, uses member ratings (avg of `user_kit_states.rating` per kit):
   * rated kits first, highest average first; unrated kits after. Requires DB RPC
   * `search_kits_catalog_by_member_rating`.
   */
  sortByMemberRating?: boolean
}

export interface CatalogPage {
  kits: CatalogKit[]
  totalCount: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface CatalogSummary {
  kitsCount: number
  teamsCount: number
  decades: string[]
  brands: string[]
  kitTypes: string[]
}

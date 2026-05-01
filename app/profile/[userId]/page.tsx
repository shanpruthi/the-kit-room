import { KitRoomShell } from "@/components/kit-room-shell"
import type { CatalogPage, CatalogSummary } from "@/lib/types"

export const dynamic = "force-dynamic"

const EMPTY_FIND_PAGE: CatalogPage = {
  kits: [],
  totalCount: 0,
  limit: 0,
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

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params

  return (
    <KitRoomShell
      initialFindPage={EMPTY_FIND_PAGE}
      summary={EMPTY_SUMMARY}
      initialRoute="profile"
      profileUserId={userId}
    />
  )
}

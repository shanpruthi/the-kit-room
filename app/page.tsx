import { KitRoomShell } from "@/components/kit-room-shell"
import { getKitRoomShellData } from "@/lib/page-data"

export default async function HomePage() {
  const { initialFindPage, summary, exploreKits, summaryNeedsRefresh } =
    await getKitRoomShellData()

  return (
    <KitRoomShell
      initialFindPage={initialFindPage}
      summary={summary}
      exploreKits={exploreKits}
      summaryNeedsRefresh={summaryNeedsRefresh}
      initialRoute="home"
    />
  )
}

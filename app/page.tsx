import { KitRoomShell } from "@/components/kit-room-shell"
import { getKitRoomShellData } from "@/lib/page-data"

export default async function HomePage() {
  const { initialFindPage, summary, summaryNeedsRefresh } =
    await getKitRoomShellData()

  return (
    <KitRoomShell
      initialFindPage={initialFindPage}
      summary={summary}
      summaryNeedsRefresh={summaryNeedsRefresh}
      initialRoute="home"
    />
  )
}

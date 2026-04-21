import { NextResponse } from "next/server"
import { getCatalogSummary } from "@/lib/kits"

export async function GET() {
  try {
    const summary = await getCatalogSummary()
    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load catalog summary."

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

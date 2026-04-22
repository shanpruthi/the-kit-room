import { NextResponse } from "next/server"
import { getSupabaseServiceRoleClient } from "@/lib/supabase-service"

/** Loose UUID v4 check for route param safety. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params

  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid profile id." }, { status: 400 })
  }

  const supabase = getSupabaseServiceRoleClient()

  if (!supabase) {
    return NextResponse.json(
      { error: "Profile data is temporarily unavailable." },
      { status: 503 },
    )
  }

  const { data: userResult, error: userLookupError } =
    await supabase.auth.admin.getUserById(userId)

  if (userLookupError || !userResult?.user) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 })
  }

  const { data: rows, error: rowsError } = await supabase
    .from("user_kit_states")
    .select("kit_id, owned, wanted, rating")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (rowsError) {
    return NextResponse.json(
      { error: "Could not load saved kits for this profile." },
      { status: 500 },
    )
  }

  const entries = (rows ?? []).map((row) => ({
    kitId: row.kit_id as number,
    owned: row.owned as boolean,
    wanted: row.wanted as boolean,
    rating: row.rating as number | null,
  }))

  const u = userResult.user
  const meta = u.user_metadata as Record<string, unknown> | undefined
  const displayName =
    (typeof meta?.full_name === "string" && meta.full_name.length > 0
      ? meta.full_name
      : null) ??
    (typeof meta?.name === "string" && meta.name.length > 0 ? meta.name : null) ??
    u.email?.split("@")[0] ??
    "Member"

  const avatarUrl =
    (typeof meta?.avatar_url === "string" && meta.avatar_url.length > 0
      ? meta.avatar_url
      : null) ??
    (typeof meta?.picture === "string" && meta.picture.length > 0 ? meta.picture : null)

  return NextResponse.json({
    entries,
    displayName,
    avatarUrl,
  })
}

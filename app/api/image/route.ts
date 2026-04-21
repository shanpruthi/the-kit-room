import { NextResponse } from "next/server"

const BASE_ALLOWED_HOSTS = new Set([
  "cdn.footballkitarchive.com",
  "footballkitarchive.com",
  "www.footballkitarchive.com",
  "lh3.googleusercontent.com",
  "googleusercontent.com",
  "supabase.co",
])

function getAllowedHosts() {
  const hosts = new Set(BASE_ALLOWED_HOSTS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (supabaseUrl) {
    try {
      hosts.add(new URL(supabaseUrl).hostname.toLowerCase())
    } catch {
      // Ignore invalid env values and fall back to the base allowlist.
    }
  }

  return hosts
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get("src")

  if (!source) {
    return new NextResponse("Missing src", { status: 400 })
  }

  let parsed: URL

  try {
    parsed = new URL(source)
  } catch {
    return new NextResponse("Invalid src", { status: 400 })
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return new NextResponse("Unsupported protocol", { status: 400 })
  }

  const hostname = parsed.hostname.toLowerCase()
  const allowedHosts = getAllowedHosts()
  const allowed = [...allowedHosts].some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  )

  if (!allowed) {
    return new NextResponse("Host not allowed", { status: 403 })
  }

  const upstream = await fetch(parsed.toString(), {
    cache: "no-store",
    headers: {
      "User-Agent": "The Kit Room Image Proxy",
    },
  })

  if (!upstream.ok) {
    return new NextResponse("Upstream image failed", { status: upstream.status })
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream"
  const arrayBuffer = await upstream.arrayBuffer()

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store, max-age=0",
    },
  })
}

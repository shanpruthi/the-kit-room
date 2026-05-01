import { NextResponse } from "next/server"
import { isHostnameAllowedForImageProxy } from "@/lib/image-proxy-shared"

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

  if (!isHostnameAllowedForImageProxy(hostname)) {
    return new NextResponse("Host not allowed", { status: 403 })
  }

  const upstream = await fetch(parsed.toString(), {
    next: { revalidate: 86_400 },
    headers: {
      "User-Agent": "The Kit Room Image Proxy",
    },
  })

  if (!upstream.ok) {
    return new NextResponse("Upstream image failed", { status: upstream.status })
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream"
  const cacheControl = "public, max-age=86400, stale-while-revalidate=604800"

  if (upstream.body) {
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    })
  }

  const arrayBuffer = await upstream.arrayBuffer()

  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
  })
}

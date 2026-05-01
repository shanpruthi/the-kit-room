const BASE_ALLOWED_HOSTS = new Set([
  "cdn.footballkitarchive.com",
  "footballkitarchive.com",
  "www.footballkitarchive.com",
  "lh3.googleusercontent.com",
  "googleusercontent.com",
  "supabase.co",
])

export function getAllowedImageProxyHosts(): Set<string> {
  const hosts = new Set(BASE_ALLOWED_HOSTS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (supabaseUrl) {
    try {
      hosts.add(new URL(supabaseUrl).hostname.toLowerCase())
    } catch {
      // Ignore invalid env values.
    }
  }

  return hosts
}

export function isHostnameAllowedForImageProxy(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  const allowedHosts = getAllowedImageProxyHosts()

  return [...allowedHosts].some(
    (host) => normalized === host || normalized.endsWith(`.${host}`),
  )
}

/**
 * Image URL for `<img src>`. When the host is already allowlisted for the proxy,
 * use the original HTTPS URL so the browser loads directly from the CDN instead of
 * routing every byte through `/api/image` (extra RTT + server buffering).
 */
export function resolveAllowedImageSrc(url: string | null | undefined): string {
  if (typeof url !== "string") {
    return ""
  }

  const trimmed = url.trim()

  if (!trimmed) {
    return ""
  }

  let parsed: URL

  try {
    parsed = new URL(trimmed)
  } catch {
    return `/api/image?src=${encodeURIComponent(trimmed)}`
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return `/api/image?src=${encodeURIComponent(trimmed)}`
  }

  if (isHostnameAllowedForImageProxy(parsed.hostname)) {
    return parsed.href
  }

  return `/api/image?src=${encodeURIComponent(trimmed)}`
}

/**
 * Kit thumbnails and modal heroes always use `/api/image`. Some archives allow our
 * server to fetch images but block anonymous browser hotlinks; direct URLs regressed
 * with broken tiles for a subset of kits.
 */
export function resolveCatalogImageSrc(url: string | null | undefined): string {
  if (typeof url !== "string") {
    return ""
  }

  const trimmed = url.trim()

  if (!trimmed) {
    return ""
  }

  return `/api/image?src=${encodeURIComponent(trimmed)}`
}

/** Alias for {@link resolveCatalogImageSrc} — shared name for kit/modal image URLs. */
export function getImageProxyUrl(url: string | null | undefined): string {
  return resolveCatalogImageSrc(url)
}

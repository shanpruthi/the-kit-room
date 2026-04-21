"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { User } from "@supabase/supabase-js"
import { AuthDialog } from "@/components/auth-dialog"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"

export const KIT_ROOM_OPEN_AUTH_EVENT = "kit-room:open-auth"

function getImageProxyUrl(url: string | null) {
  if (!url) {
    return ""
  }

  return `/api/image?src=${encodeURIComponent(url)}`
}

function getUserAvatarUrl(user: User | null) {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined
  const avatarUrl = metadata?.avatar_url
  const picture = metadata?.picture

  if (typeof avatarUrl === "string" && avatarUrl.length > 0) {
    return avatarUrl
  }

  if (typeof picture === "string" && picture.length > 0) {
    return picture
  }

  return null
}

function getUserDisplayName(user: User | null) {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined
  const fullName = metadata?.full_name
  const name = metadata?.name

  if (typeof fullName === "string" && fullName.length > 0) {
    return fullName
  }

  if (typeof name === "string" && name.length > 0) {
    return name
  }

  return user?.email ?? "Member"
}

const navTextClass =
  "font-[family-name:var(--font-sans),sans-serif] text-[12px] font-normal leading-[1.2]"

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      scroll={true}
      prefetch={true}
      className={`site-nav-link inline-flex items-center transition hover:text-[#111] ${navTextClass} ${
        active ? "site-nav-link--active" : ""
      }`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  )
}

export function SiteNav() {
  const pathname = usePathname()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authSubmitting, setAuthSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return
      }

      if (error) {
        setCurrentUser(null)
        setAuthResolved(true)
        return
      }

      setCurrentUser(data.session?.user ?? null)
      setAuthResolved(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null)
      setAuthResolved(true)
      setAuthDialogOpen(false)
      setAuthSubmitting(false)
      setAuthError(null)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    function onOpenAuth() {
      setAuthError(null)
      setAuthDialogOpen(true)
    }

    window.addEventListener(KIT_ROOM_OPEN_AUTH_EVENT, onOpenAuth)
    return () => window.removeEventListener(KIT_ROOM_OPEN_AUTH_EVENT, onOpenAuth)
  }, [])

  const isHome = pathname === "/"
  const isTrends =
    pathname === "/trends" || pathname.startsWith("/trends/")
  const isAbout = pathname === "/about"
  const isProfile = pathname.startsWith("/profile")

  const currentUserAvatarUrl = getUserAvatarUrl(currentUser)
  const currentUserDisplayName = getUserDisplayName(currentUser)

  const openLogin = useCallback(() => {
    setAuthError(null)
    setAuthDialogOpen(true)
  }, [])

  async function handleGoogleAuth() {
    setAuthSubmitting(true)
    setAuthError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    })

    if (error) {
      setAuthError(error.message)
      setAuthSubmitting(false)
    }
  }

  return (
    <>
      <nav
        className="flex shrink-0 items-center gap-5 sm:gap-6"
        aria-label="Site"
      >
        <NavLink href="/" active={isHome}>
          Kit Room
        </NavLink>
        <NavLink href="/trends" active={isTrends}>
          Trends
        </NavLink>
        <NavLink href="/about" active={isAbout}>
          About
        </NavLink>

        {authResolved ? (
          currentUser ? (
            <Link
              href={`/profile/${currentUser.id}`}
              prefetch={true}
              className={`inline-flex items-center rounded-full border-b-2 border-transparent pb-0.5 ${navTextClass} ${
                isProfile
                  ? "border-[#111]"
                  : "hover:opacity-85"
              }`}
              aria-label="Profile"
            >
              {currentUserAvatarUrl ? (
                <img
                  src={getImageProxyUrl(currentUserAvatarUrl)}
                  alt={`${currentUserDisplayName} profile`}
                  className="rounded-full object-cover"
                  style={{ width: "22px", height: "22px" }}
                />
              ) : (
                <span
                  className="flex items-center justify-center rounded-full bg-[#f2f2f2] text-[10px] uppercase text-[#777]"
                  style={{ width: "22px", height: "22px" }}
                >
                  {(currentUser.email ?? "U").slice(0, 1)}
                </span>
              )}
            </Link>
          ) : (
            <button
              type="button"
              onClick={openLogin}
              className={`inline-flex cursor-pointer items-center border-0 bg-transparent p-0 ${navTextClass} text-[#555] antialiased transition hover:text-[#111]`}
              style={{
                fontSize: "12px",
                lineHeight: 1.2,
                WebkitAppearance: "none",
                appearance: "none",
              }}
            >
              Login / Sign up
            </button>
          )
        ) : (
          <div
            className="rounded-full bg-[#f2f2f2]"
            style={{ width: "22px", height: "22px" }}
            aria-hidden
          />
        )}
      </nav>

      <AuthDialog
        isOpen={authDialogOpen}
        message={null}
        error={authError}
        isSubmitting={authSubmitting}
        onClose={() => setAuthDialogOpen(false)}
        onGoogleAuth={handleGoogleAuth}
      />
    </>
  )
}

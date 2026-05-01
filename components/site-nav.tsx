"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from "react"
import { createPortal } from "react-dom"
import type { User } from "@supabase/supabase-js"
import { AuthDialog } from "@/components/auth-dialog"
import { resolveAllowedImageSrc } from "@/lib/image-proxy-shared"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"

export const KIT_ROOM_OPEN_AUTH_EVENT = "kit-room:open-auth"

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
      className={`inline-flex items-center border-b-2 pb-0.5 transition ${navTextClass} ${
        active
          ? "border-[#111] text-[#111]"
          : "border-transparent text-[#555] hover:text-[#111]"
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

  // `usePathname()` can lag or be null briefly (including right after OAuth redirect to
  // `/#access_token=...` — pathname is still `/`, hash is ignored by pathname).
  const isHome =
    pathname === "/" ||
    pathname === "" ||
    (typeof window !== "undefined" &&
      (window.location.pathname === "/" || window.location.pathname === "") &&
      pathname == null)

  const isTrends =
    pathname === "/trends" || pathname?.startsWith("/trends/") === true
  const isAbout = pathname === "/about"
  const isProfile = pathname?.startsWith("/profile") === true

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

  const [drawerMounted, setDrawerMounted] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null)
  const drawerOpenRef = useRef(drawerOpen)
  const drawerUnmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousPathnameRef = useRef(pathname)
  drawerOpenRef.current = drawerOpen

  useEffect(() => {
    if (!drawerMounted) {
      return
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDrawerOpen(true)
      })
    })
    return () => cancelAnimationFrame(id)
  }, [drawerMounted])

  useEffect(() => {
    if (!drawerMounted) {
      return
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [drawerMounted])

  const clearDrawerUnmountTimer = useCallback(() => {
    if (drawerUnmountTimerRef.current != null) {
      clearTimeout(drawerUnmountTimerRef.current)
      drawerUnmountTimerRef.current = null
    }
  }, [])

  const closeMobileDrawer = useCallback(() => {
    setDrawerOpen(false)
    clearDrawerUnmountTimer()
    drawerUnmountTimerRef.current = setTimeout(() => {
      drawerUnmountTimerRef.current = null
      if (!drawerOpenRef.current) {
        setDrawerMounted(false)
      }
    }, 400)
  }, [clearDrawerUnmountTimer])

  useEffect(() => {
    if (previousPathnameRef.current === pathname) {
      return
    }
    previousPathnameRef.current = pathname
    if (drawerMounted) {
      closeMobileDrawer()
    }
  }, [pathname, drawerMounted, closeMobileDrawer])

  useEffect(() => {
    return () => {
      if (drawerUnmountTimerRef.current != null) {
        clearTimeout(drawerUnmountTimerRef.current)
      }
    }
  }, [])

  function onMobileDrawerTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== "transform") {
      return
    }
    if (event.target !== mobileDrawerRef.current) {
      return
    }
    if (drawerOpenRef.current) {
      return
    }
    clearDrawerUnmountTimer()
    setDrawerMounted(false)
  }

  const desktopNav = (
    <nav
      className="hidden shrink-0 items-center gap-5 sm:gap-6 md:flex"
      aria-label="Site"
    >
      <NavLink href="/" active={isHome}>
        The Kit Room
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
              isProfile ? "border-[#111]" : "hover:opacity-85"
            }`}
            aria-label="Profile"
          >
            {currentUserAvatarUrl ? (
              <img
                src={resolveAllowedImageSrc(currentUserAvatarUrl)}
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
            className="m-0 inline-flex min-h-0 cursor-pointer items-center border-0 border-b-2 border-transparent bg-transparent p-0 pb-0.5 text-[#555] transition hover:text-[#111]"
            style={{
              WebkitAppearance: "none",
              appearance: "none",
              font: "unset",
            }}
          >
            <span className={navTextClass}>Login / Sign up</span>
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
  )

  const linkClose = () => {
    closeMobileDrawer()
  }

  const mobileMenuPanel =
    drawerMounted && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[60] flex flex-col md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            aria-hidden={!drawerOpen}
          >
            <button
              type="button"
              className={`absolute inset-0 z-0 border-0 bg-[#0a0a0a] transition-[opacity] duration-300 ease-out motion-reduce:transition-none ${
                drawerOpen ? "opacity-30" : "opacity-0"
              }`}
              aria-label="Close menu"
              onClick={closeMobileDrawer}
            />
            <div
              ref={mobileDrawerRef}
              onTransitionEnd={onMobileDrawerTransitionEnd}
              className={`absolute right-0 top-0 z-10 flex h-full w-[min(20rem,88vw)] flex-col border-l border-[var(--line)] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none ${
                drawerOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="flex h-14 shrink-0 items-center justify-end border-b border-[var(--line)] px-4">
                <button
                  type="button"
                  onClick={closeMobileDrawer}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#555] transition hover:bg-[#f4f4f4]"
                  aria-label="Close menu"
                >
                  <span className="text-[22px] leading-none" aria-hidden>
                    ×
                  </span>
                </button>
              </div>
              <nav
                className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4"
                aria-label="Site"
              >
                <Link
                  href="/"
                  onClick={linkClose}
                  className={`rounded-lg px-3 py-2.5 ${navTextClass} ${
                    isHome ? "bg-[#f4f4f4] text-[#111]" : "text-[#555]"
                  }`}
                >
                  The Kit Room
                </Link>
                <Link
                  href="/trends"
                  onClick={linkClose}
                  className={`rounded-lg px-3 py-2.5 ${navTextClass} ${
                    isTrends ? "bg-[#f4f4f4] text-[#111]" : "text-[#555]"
                  }`}
                >
                  Trends
                </Link>
                <Link
                  href="/about"
                  onClick={linkClose}
                  className={`rounded-lg px-3 py-2.5 ${navTextClass} ${
                    isAbout ? "bg-[#f4f4f4] text-[#111]" : "text-[#555]"
                  }`}
                >
                  About
                </Link>
                {authResolved ? (
                  currentUser ? (
                    <Link
                      href={`/profile/${currentUser.id}`}
                      onClick={linkClose}
                      prefetch={true}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 ${navTextClass} ${
                        isProfile
                          ? "bg-[#f4f4f4] text-[#111]"
                          : "text-[#555]"
                      }`}
                    >
                      {currentUserAvatarUrl ? (
                        <img
                          src={resolveAllowedImageSrc(currentUserAvatarUrl)}
                          alt=""
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
                      Profile
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        closeMobileDrawer()
                        openLogin()
                      }}
                      className="rounded-lg px-3 py-2.5 text-left text-[#555]"
                    >
                      <span className={navTextClass}>Login / Sign up</span>
                    </button>
                  )
                ) : null}
              </nav>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      {desktopNav}
      <div className="flex items-center md:hidden">
        <button
          type="button"
          onClick={() => {
            if (!drawerMounted) {
              setDrawerMounted(true)
            } else if (drawerOpen) {
              closeMobileDrawer()
            } else {
              setDrawerOpen(true)
            }
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#111] transition hover:bg-[#f0f0f0]"
          aria-expanded={drawerOpen}
          aria-label={drawerMounted ? "Close menu" : "Open menu"}
        >
          {drawerMounted ? (
            <span className="text-[22px] leading-none text-[#333]" aria-hidden>
              ×
            </span>
          ) : (
            <span className="flex flex-col items-center justify-center gap-[5px]" aria-hidden>
              <span className="h-0.5 w-5 bg-[#222]" />
              <span className="h-0.5 w-5 bg-[#222]" />
              <span className="h-0.5 w-5 bg-[#222]" />
            </span>
          )}
        </button>
      </div>
      {mobileMenuPanel}

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

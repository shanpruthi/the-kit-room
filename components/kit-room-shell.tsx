"use client"

import { useRouter } from "next/navigation"
import {
  memo,
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import type { User } from "@supabase/supabase-js"
import { useHeaderSlot } from "@/components/header-slot"
import { KIT_ROOM_OPEN_AUTH_EVENT } from "@/components/site-nav"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import type { CatalogKit, CatalogPage, CatalogSummary, UserKitState } from "@/lib/types"

type KitRoomShellProps = {
  initialFindPage: CatalogPage
  summary: CatalogSummary
  exploreKits?: CatalogKit[]
  summaryNeedsRefresh?: boolean
  initialRoute?: "home" | "about" | "profile"
  profileUserId?: string
}

const FIND_PAGE_SIZE_DESKTOP = 150
const FIND_PAGE_SIZE_MOBILE = 20

const colorOptions = [
  { name: "Red", hex: "#c53b32" },
  { name: "Blue", hex: "#2457b2" },
  { name: "Green", hex: "#2c9b54" },
  { name: "Yellow", hex: "#ebc63a" },
  { name: "Black", hex: "#1d1d1d" },
  { name: "White", hex: "#f2f0ea" },
  { name: "Orange", hex: "#de7b33" },
  { name: "Purple", hex: "#7b48d6" },
]

const preferredBrandOrder = [
  "adidas",
  "Nike",
  "Puma",
  "Umbro",
  "Macron",
  "Kappa",
  "Hummel",
  "Jako",
  "Le Coq Sportif",
  "Joma",
]

const preferredKitTypeOrder = [
  "home",
  "away",
  "third",
  "gk 1",
  "gk 2",
  "gk home",
  "gk away",
  "special",
  "gk",
  "gk 3",
]

const emptyUserKitState: UserKitState = {
  owned: false,
  wanted: false,
  rating: null,
}

type MultiSelectDropdownProps = {
  label: string
  placeholder: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Tighter control + label only on `md+` (for mobile filter rows). */
  compact?: boolean
  className?: string
}

type UserKitStateRow = {
  user_id: string
  kit_id: number
  owned: boolean
  wanted: boolean
  rating: number | null
}

type SavedKitEntry = UserKitState & {
  kitId: number
}

type ProfileTab = "rated" | "owned" | "wanted"

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

function buildFindQueryKey({
  search,
  decades,
  brands,
  kitTypes,
  colors,
}: {
  search: string
  decades: string[]
  brands: string[]
  kitTypes: string[]
  colors: string[]
}) {
  return JSON.stringify({
    search,
    decades,
    brands,
    kitTypes,
    colors,
  })
}

function isUnfilteredFindQuery(
  search: string,
  decades: string[],
  brands: string[],
  kitTypes: string[],
  colors: string[],
) {
  return (
    search.trim() === "" &&
    decades.length === 0 &&
    brands.length === 0 &&
    kitTypes.length === 0 &&
    colors.length === 0
  )
}

function getDecade(year: number | null) {
  if (!year) {
    return "Unknown"
  }

  const decadeStart = Math.floor(year / 10) * 10
  const decadeEnd = decadeStart + 9
  return `${decadeStart}-${decadeEnd}`
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function getRegion(country: string) {
  const normalized = country.toLowerCase()

  if (
    [
      "england",
      "spain",
      "italy",
      "germany",
      "france",
      "netherlands",
      "portugal",
      "scotland",
      "belgium",
      "croatia",
      "sweden",
      "norway",
      "denmark",
      "turkey",
      "greece",
      "ukraine",
      "switzerland",
      "czech republic",
      "austria",
      "serbia",
    ].includes(normalized)
  ) {
    return "Europe"
  }

  if (
    [
      "brazil",
      "argentina",
      "mexico",
      "usa",
      "united states",
      "uruguay",
      "chile",
      "colombia",
      "peru",
    ].includes(normalized)
  ) {
    return "Americas"
  }

  if (
    [
      "nigeria",
      "cameroon",
      "morocco",
      "ghana",
      "senegal",
      "egypt",
      "south africa",
      "ivory coast",
    ].includes(normalized)
  ) {
    return "Africa"
  }

  return "Asia"
}

function hexToRgb(hex: string) {
  const sanitized = hex.replace("#", "")

  if (sanitized.length !== 6) {
    return null
  }

  return {
    r: Number.parseInt(sanitized.slice(0, 2), 16),
    g: Number.parseInt(sanitized.slice(2, 4), 16),
    b: Number.parseInt(sanitized.slice(4, 6), 16),
  }
}

function colorDistance(left: string, right: string) {
  const leftRgb = hexToRgb(left)
  const rightRgb = hexToRgb(right)

  if (!leftRgb || !rightRgb) {
    return Number.POSITIVE_INFINITY
  }

  return Math.sqrt(
    (leftRgb.r - rightRgb.r) ** 2 +
      (leftRgb.g - rightRgb.g) ** 2 +
      (leftRgb.b - rightRgb.b) ** 2,
  )
}

function paletteMatchesKit(kit: CatalogKit, paletteHex: string | null) {
  if (!paletteHex) {
    return true
  }

  return kit.colors.some((color) => {
    if (!color.hex) {
      return false
    }

    return colorDistance(color.hex, paletteHex) <= 90
  })
}

function kitMatchesQuery(kit: CatalogKit, query: string) {
  if (!query) {
    return true
  }

  const haystack = [
    kit.title,
    kit.teamName,
    kit.teamCountry,
    kit.brandName,
    kit.seasonLabel,
    kit.kitType,
    kit.variantName ?? "",
    kit.sponsorName ?? "",
    kit.description ?? "",
    ...kit.colors.map((color) => color.name),
    ...kit.competitions.map((competition) => competition.name),
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(query)
}

function orderFilterOptions(options: string[], preferredOrder: string[]) {
  const remaining = [...options]
  const ordered: string[] = []

  preferredOrder.forEach((preferred) => {
    const index = remaining.findIndex(
      (option) => option.toLowerCase() === preferred.toLowerCase(),
    )

    if (index === -1) {
      return
    }

    ordered.push(remaining[index]!)
    remaining.splice(index, 1)
  })

  return [...ordered, ...remaining]
}

function MultiSelectDropdown({
  label,
  placeholder,
  options,
  selected,
  onChange,
  compact = false,
  className: wrapperClassName = "",
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node

      if (
        !wrapperRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      return
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()

      if (!rect) {
        return
      }

      setPanelStyle({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      })
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [isOpen])

  const buttonLabel =
    selected.length === 0
      ? placeholder
      : selected.join(", ")

  const dropdownPanel =
    isOpen && panelStyle
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[70] max-h-64 overflow-auto rounded-[10px] border border-[var(--line)] bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
            style={{
              top: `${panelStyle.top}px`,
              left: `${panelStyle.left}px`,
              width: `${panelStyle.width}px`,
            }}
          >
            <button
              type="button"
              onClick={() => onChange([])}
              className="mb-1 w-full rounded-[6px] px-2 py-1.5 text-left text-[11px] text-[#888] hover:bg-[#f7f7f7]"
              style={{
                fontFamily: "var(--font-sans), sans-serif",
                fontSize: "11px",
                fontWeight: 400,
                lineHeight: "1.2",
                color: "#888",
              }}
            >
              Clear
            </button>
            <div className="space-y-1">
              {options.map((option) => {
                const isSelected = selected.includes(option)

                return (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-[11px] text-[#555] hover:bg-[#f7f7f7]"
                    style={{
                      fontFamily: "var(--font-sans), sans-serif",
                      fontSize: "11px",
                      fontWeight: 400,
                      lineHeight: "1.2",
                      color: "#555",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          onChange([...selected, option])
                        } else {
                          onChange(selected.filter((item) => item !== option))
                        }
                      }}
                      className="h-3.5 w-3.5"
                    />
                    <span>{option}</span>
                  </label>
                )
              })}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div
      ref={wrapperRef}
      className={`relative ${compact ? "space-y-0.5 md:space-y-1" : "space-y-1"} ${wrapperClassName}`}
    >
      <span
        className={`${
          compact
            ? "sr-only md:block"
            : "block"
        } text-[11px] uppercase leading-[1.2] tracking-[0.12em] text-[#9a9a9a]`}
      >
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(event) => {
          event.preventDefault()
        }}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex w-full items-center justify-between rounded-[8px] border border-[var(--line)] bg-white text-[11px] text-[#555] ${
          compact
            ? "px-2 py-1.5 md:px-3 md:py-2"
            : "px-3 py-1.5"
        }`}
        style={{
          fontFamily: "var(--font-sans), sans-serif",
          fontSize: "11px",
          fontWeight: 400,
          lineHeight: "1.2",
          color: "#555",
        }}
      >
        <span className="truncate">{buttonLabel}</span>
        <span className="ml-2 shrink-0 text-[11px] leading-[1.2] text-[#888]">▾</span>
      </button>
      {dropdownPanel}
    </div>
  )
}

function ShirtTile({
  kit,
  onImageError,
  imageSrc,
  imageLoading = "eager",
  animateImage = false,
  imageLoaded = true,
  onImageLoad,
}: {
  kit: CatalogKit
  onImageError: (kitId: number) => void
  imageSrc?: string | null
  imageLoading?: "eager" | "lazy"
  animateImage?: boolean
  imageLoaded?: boolean
  onImageLoad?: () => void
}) {
  const resolvedImageSrc =
    imageSrc === undefined ? getImageProxyUrl(kit.imageUrl) : imageSrc

  const imageHiddenUntilLoaded = animateImage && !imageLoaded

  return (
    <div
      className="relative mx-auto flex aspect-[3/4] w-full max-w-[11.4rem] items-center justify-center overflow-hidden rounded-[4px] bg-white"
      style={{ background: "#ffffff" }}
    >
      {resolvedImageSrc ? (
        <img
          src={resolvedImageSrc}
          alt=""
          role="presentation"
          loading={imageLoading}
          decoding="async"
          className={`max-h-full max-w-full object-contain transition duration-300 ${
            animateImage
              ? imageLoaded
                ? "opacity-100 visible"
                : "opacity-0 invisible"
              : ""
          }`}
          aria-hidden={imageHiddenUntilLoaded ? true : undefined}
          onLoad={onImageLoad}
          onError={() => onImageError(kit.id)}
        />
      ) : null}
    </div>
  )
}

function KitModal({
  kit,
  currentUser,
  userKitState,
  userKitStateLoading,
  userKitStateSaving,
  kitStateNotice,
  onAuthRequest,
  onToggleOwned,
  onToggleWanted,
  onRatingChange,
  onClose,
  readOnly = false,
}: {
  kit: CatalogKit | null
  currentUser: User | null
  userKitState: UserKitState
  userKitStateLoading: boolean
  userKitStateSaving: boolean
  kitStateNotice: string | null
  onAuthRequest: () => void
  onToggleOwned: () => void
  onToggleWanted: () => void
  onRatingChange: (rating: number) => void
  onClose: () => void
  /** Someone else's profile / collection — show their saved state without editing. */
  readOnly?: boolean
}) {
  useEffect(() => {
    if (!kit) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [kit])

  if (!kit) {
    return null
  }

  const imageUrl = kit.imageUrl
  const dominantColor = kit.colors[0]?.hex ?? "#dbd1c3"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-[10px] border border-[var(--line)] bg-white"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="absolute right-5 top-5 z-10 h-10 w-10 rounded-full border border-[var(--line)] bg-white text-lg transition hover:bg-[#f7f7f7]"
          onClick={onClose}
          aria-label="Close kit details"
        >
          ×
        </button>

        <div className="grid gap-8 p-5 md:grid-cols-[1.05fr_0.95fr] md:p-8">
          <div className="flex items-center justify-center overflow-hidden rounded-[8px] border border-[var(--line)] bg-white">
            {imageUrl ? (
              <img
                src={getImageProxyUrl(imageUrl)}
                alt={kit.title}
                className="h-full max-h-[38rem] w-full object-contain"
              />
            ) : (
              <div
                className="flex min-h-[26rem] items-center justify-center"
                style={{ background: dominantColor }}
              >
                <span className="text-4xl font-light text-white/75">
                  {kit.teamName}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                  {kit.teamCountry} · {kit.teamType}
                </p>
                <h2 className="text-balance text-4xl font-light leading-none">
                  {kit.title}
                </h2>
                <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                  <span>{kit.seasonLabel}</span>
                  <span>{kit.brandName}</span>
                  <span className="capitalize">{kit.kitType}</span>
                  {kit.variantName ? <span>{kit.variantName}</span> : null}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  {readOnly ? "Kit log" : "Your kit log"}
                </p>

                {readOnly ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3.5 py-1.5 text-[12px] ${
                          userKitState.owned
                            ? "border-[#111] bg-[#111] text-white"
                            : "border-[var(--line)] bg-white text-[#555]"
                        }`}
                      >
                        Own
                      </span>
                      <span
                        className={`rounded-full border px-3.5 py-1.5 text-[12px] ${
                          userKitState.wanted
                            ? "border-[#111] bg-[#111] text-white"
                            : "border-[var(--line)] bg-white text-[#555]"
                        }`}
                      >
                        Want
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((value) => {
                        const isActive = (userKitState.rating ?? 0) >= value

                        return (
                          <span
                            key={value}
                            className={`text-[20px] leading-none ${
                              isActive ? "text-[#111]" : "text-[#d0d0d0]"
                            }`}
                            aria-hidden
                          >
                            ★
                          </span>
                        )
                      })}
                      <span className="ml-2 text-[12px] text-[#777]">
                        {userKitState.rating
                          ? `${userKitState.rating}/5`
                          : "No rating yet"}
                      </span>
                    </div>
                  </div>
                ) : currentUser ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={onToggleOwned}
                        disabled={userKitStateLoading || userKitStateSaving}
                        className={`rounded-full border px-3.5 py-1.5 text-[12px] transition ${
                          userKitState.owned
                            ? "border-[#111] bg-[#111] text-white"
                            : "border-[var(--line)] bg-white text-[#555]"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        Own
                      </button>
                      <button
                        type="button"
                        onClick={onToggleWanted}
                        disabled={userKitStateLoading || userKitStateSaving}
                        className={`rounded-full border px-3.5 py-1.5 text-[12px] transition ${
                          userKitState.wanted
                            ? "border-[#111] bg-[#111] text-white"
                            : "border-[var(--line)] bg-white text-[#555]"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        Want
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((value) => {
                        const isActive = (userKitState.rating ?? 0) >= value

                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => onRatingChange(value)}
                            disabled={userKitStateLoading || userKitStateSaving}
                            className={`text-[20px] leading-none transition ${
                              isActive ? "text-[#111]" : "text-[#d0d0d0]"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                            aria-label={`Rate ${value} out of 5`}
                          >
                            ★
                          </button>
                        )
                      })}
                      <span className="ml-2 text-[12px] text-[#777]">
                        {userKitState.rating
                          ? `${userKitState.rating}/5`
                          : "No rating yet"}
                      </span>
                    </div>

                    {kitStateNotice ? (
                      <p className="text-[12px] leading-5 text-[#777]">
                        {kitStateNotice}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[10px] border border-[var(--line)] bg-[#fafafa] p-4">
                    <p className="text-[13px] leading-6 text-[#666]">
                      Sign up with Google to save what you own, track what you
                      want, and rate kits across the archive.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onAuthRequest()}
                        className="rounded-full bg-[#111] px-4 py-2 text-[13px] text-white"
                      >
                        Login / Sign up
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {kit.description ? (
                <p className="max-w-xl text-base leading-7 text-[#555]">
                  {kit.description}
                </p>
              ) : null}

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {kit.competitions.length ? (
                    kit.competitions.map((competition) => (
                      <span
                        key={`${kit.id}-${competition.name}-${competition.outcome ?? "none"}`}
                        className="rounded-full border border-[var(--line)] bg-[#fafafa] px-4 py-2 text-sm"
                      >
                        {competition.name}
                        {competition.outcome ? ` · ${competition.outcome}` : ""}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm text-[var(--muted)]">
                      No competition notes yet
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                  Palette
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {kit.colors.slice(0, 6).map((color) => (
                    <span
                      key={`${kit.id}-${color.name}`}
                      className="inline-flex items-center gap-2 text-[12px] text-[#777]"
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-black/5"
                        style={{ background: color.hex ?? "#d6cab4" }}
                        title={color.name}
                      />
                      {color.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

function KitCard({
  kit,
  onSelect,
  onImageError,
}: {
  kit: CatalogKit
  onSelect: (kit: CatalogKit) => void
  onImageError: (kitId: number) => void
}) {
  return (
    <button className="group text-center" onClick={() => onSelect(kit)} type="button">
      <article className="transition duration-200 hover:opacity-85">
        <ShirtTile kit={kit} onImageError={onImageError} />
        <CatalogKitCaption teamName={kit.teamName} seasonLabel={kit.seasonLabel} brandName={kit.brandName} />
      </article>
    </button>
  )
}

function CatalogKitCaption({
  teamName,
  seasonLabel,
  brandName,
}: {
  teamName: string
  seasonLabel: string
  brandName: string
}) {
  return (
    <div className="mx-auto mt-3 flex max-w-[11.4rem] flex-col gap-1 text-center">
      <h3 className="line-clamp-2 text-[11px] font-normal leading-[1.25] tracking-[-0.01em] text-[#222]">
        {teamName}
      </h3>
      <p className="line-clamp-1 text-[10px] leading-[1.25] text-[#a0a0a0]">
        {seasonLabel} · {brandName}
      </p>
    </div>
  )
}

/** Stable pseudo-random translate/rotate/scale per kit so mosaic feels scattered, not rigid rows. */
function exploreScatterStyle(kitId: number): CSSProperties {
  let x = kitId >>> 0
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  const u1 = (x >>> 0) / 4294967296
  x = Math.imul(x ^ (x >>> 11), 2654435761)
  const u2 = (x >>> 0) / 4294967296
  x = Math.imul(x ^ (x >>> 15), 1597334677)
  const u3 = (x >>> 0) / 4294967296
  x = Math.imul(x ^ (x >>> 9), 2246822519)
  const u4 = (x >>> 0) / 4294967296
  const tx = Math.round((u1 - 0.5) * 72)
  const ty = Math.round((u2 - 0.5) * 62)
  const deg = (u3 - 0.5) * 11
  const scale = 0.975 + u4 * 0.05

  return {
    transform: `translate(${tx}px, ${ty}px) rotate(${deg.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
    justifySelf: "center",
  }
}

/** Fixed Explore slot with no text or faux caption rows (blank tile + reserved caption height). */
function ExploreGridPlaceholder() {
  return (
    <div className="pointer-events-none w-[11.4rem] shrink-0 select-none" aria-hidden>
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[11.4rem] rounded-[4px] bg-white" />
      <div className="mx-auto mt-3 h-[2.75rem] max-w-[11.4rem]" />
    </div>
  )
}

/**
 * Hidden until near/in view, then slide-up + lazy image fade-in (same motion on Find and Explore).
 * Explore passes `isExploreGrid` for fixed tile width in the horizontal mosaic.
 */
function CatalogKitCard({
  kit,
  onSelect,
  onImageError,
  viewportRoot,
  observeDocumentViewport = false,
  isExploreGrid = false,
}: {
  kit: CatalogKit
  onSelect: (kit: CatalogKit) => void
  onImageError: (kitId: number) => void
  /** Scroll container for Explore; ignored when `observeDocumentViewport` is true. */
  viewportRoot: HTMLElement | null
  /** Find uses window scroll; Explore uses `viewportRoot` once the pane ref is ready. */
  observeDocumentViewport?: boolean
  /** Explore horizontal grid: fixed column width so cells align with `repeat(31, 11.4rem)`. */
  isExploreGrid?: boolean
}) {
  const cardRef = useRef<HTMLButtonElement>(null)
  const [hasEnteredView, setHasEnteredView] = useState(false)
  const [shouldLoadImage, setShouldLoadImage] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    const node = cardRef.current

    if (!node) {
      return
    }

    if (!observeDocumentViewport && !viewportRoot) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]

        if (!entry?.isIntersecting) {
          return
        }

        setHasEnteredView(true)
        setShouldLoadImage(true)
      },
      {
        root: observeDocumentViewport ? null : viewportRoot,
        rootMargin: "320px",
        threshold: 0.08,
      },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [observeDocumentViewport, viewportRoot])

  const motionClass = hasEnteredView ? "slide-up" : "opacity-0"

  const exploreWidthClass = isExploreGrid ? "w-[11.4rem] shrink-0" : ""

  const exploreAwaitingImage = isExploreGrid && !imageLoaded

  return (
    <button
      ref={cardRef}
      className={`group text-center ${exploreWidthClass} ${motionClass} ${
        exploreAwaitingImage ? "pointer-events-none cursor-default" : ""
      }`.trim()}
      onClick={() => onSelect(kit)}
      type="button"
    >
      <article className="transition duration-200 hover:opacity-85">
        <ShirtTile
          kit={kit}
          onImageError={onImageError}
          imageSrc={shouldLoadImage ? getImageProxyUrl(kit.imageUrl) : null}
          imageLoading="lazy"
          animateImage
          imageLoaded={imageLoaded}
          onImageLoad={() => setImageLoaded(true)}
        />
        {isExploreGrid ? (
          imageLoaded ? (
            <CatalogKitCaption
              teamName={kit.teamName}
              seasonLabel={kit.seasonLabel}
              brandName={kit.brandName}
            />
          ) : (
            <div className="mx-auto mt-3 h-[2.75rem] max-w-[11.4rem]" aria-hidden />
          )
        ) : (
          <CatalogKitCaption
            teamName={kit.teamName}
            seasonLabel={kit.seasonLabel}
            brandName={kit.brandName}
          />
        )}
      </article>
    </button>
  )
}

const FIND_GRID_SKELETON_PLACEHOLDERS = 18

function FindGridSkeleton() {
  return (
    <div className="mx-auto mt-10 grid max-w-7xl grid-cols-2 items-start gap-x-2 gap-y-7 min-[380px]:grid-cols-3 min-[380px]:gap-x-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: FIND_GRID_SKELETON_PLACEHOLDERS }).map((_, index) => (
        <div
          key={index}
          className="min-w-0 text-center fade-in"
          style={{ animationDelay: `${Math.min(index * 18, 280)}ms` }}
        >
          <div className="mx-auto aspect-[3/4] w-full max-w-[11.4rem] animate-pulse rounded-[4px] bg-[#f0f0f0]" />
          <div className="mx-auto mt-3 flex max-w-[11.4rem] flex-col gap-1 text-center">
            <div className="mx-auto h-3 w-24 animate-pulse rounded bg-[#ececec]" />
            <div className="mx-auto h-2.5 w-20 animate-pulse rounded bg-[#ececec]" />
          </div>
        </div>
      ))}
    </div>
  )
}

const KitGrid = memo(function KitGrid({
  kits,
  onSelect,
  onImageError,
}: {
  kits: CatalogKit[]
  onSelect: (kit: CatalogKit) => void
  onImageError: (kitId: number) => void
}) {
  return (
    <div className="mx-auto mt-10 grid max-w-7xl grid-cols-2 items-start gap-x-2 gap-y-7 min-[380px]:grid-cols-3 min-[380px]:gap-x-3 sm:gap-x-5 sm:gap-y-10 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {kits.map((kit) => (
        <div key={kit.id} className="min-w-0">
          <CatalogKitCard
            kit={kit}
            onSelect={onSelect}
            onImageError={onImageError}
            viewportRoot={null}
            observeDocumentViewport
          />
        </div>
      ))}
    </div>
  )
})

function ProfileSection({
  title,
  kits,
  emptyMessage,
  onSelect,
  onImageError,
}: {
  title: string
  kits: CatalogKit[]
  emptyMessage: string
  onSelect: (kit: CatalogKit) => void
  onImageError: (kitId: number) => void
}) {
  return (
    <section className="space-y-5">
      <h2 className="text-[18px] font-normal tracking-[-0.02em] text-[#111]">
        {title}
      </h2>

      {kits.length ? (
        <div className="slide-up grid items-start gap-x-5 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {kits.map((kit) => (
            <KitCard
              key={`${title}-${kit.id}`}
              kit={kit}
              onSelect={onSelect}
              onImageError={onImageError}
            />
          ))}
        </div>
      ) : (
        <p className="slide-up text-[14px] text-[#777]">{emptyMessage}</p>
      )}
    </section>
  )
}

export function KitRoomShell({
  initialFindPage,
  summary,
  exploreKits = [],
  summaryNeedsRefresh = false,
  initialRoute = "home",
  profileUserId,
}: KitRoomShellProps) {
  const router = useRouter()
  const browserSupabase = useMemo(() => getSupabaseBrowserClient(), [])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [catalogSummary, setCatalogSummary] = useState(summary)
  const [activeDecades, setActiveDecades] = useState<string[]>([])
  const [activeBrands, setActiveBrands] = useState<string[]>([])
  const [activeKitTypes, setActiveKitTypes] = useState<string[]>([])
  const [activeColors, setActiveColors] = useState<string[]>([])
  const [findKits, setFindKits] = useState<CatalogKit[]>(initialFindPage.kits)
  const [findTotalCount, setFindTotalCount] = useState(initialFindPage.totalCount)
  const [findHasMore, setFindHasMore] = useState(initialFindPage.hasMore)
  const [findLoading, setFindLoading] = useState(false)
  const [findLoadingMore, setFindLoadingMore] = useState(false)
  const [findError, setFindError] = useState<string | null>(null)
  const [selectedKit, setSelectedKit] = useState<CatalogKit | null>(null)
  const [showAbout] = useState(initialRoute === "about")
  const [showProfile] = useState(initialRoute === "profile")
  const [profileTab, setProfileTab] = useState<ProfileTab>("rated")
  const [viewMode, setViewMode] = useState<"find" | "explore">("find")
  const [findPageSize, setFindPageSize] = useState(FIND_PAGE_SIZE_MOBILE)
  const findPageSizeRef = useRef(FIND_PAGE_SIZE_MOBILE)
  findPageSizeRef.current = findPageSize
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [brokenImageIds, setBrokenImageIds] = useState<number[]>([])
  const [savedKitEntries, setSavedKitEntries] = useState<SavedKitEntry[]>([])
  const [savedKitEntriesLoading, setSavedKitEntriesLoading] = useState(false)
  const [profileKits, setProfileKits] = useState<CatalogKit[]>([])
  const [profileKitsLoading, setProfileKitsLoading] = useState(false)
  const [publicProfileEntries, setPublicProfileEntries] = useState<SavedKitEntry[]>([])
  const [publicProfileMeta, setPublicProfileMeta] = useState<{
    displayName: string
    avatarUrl: string | null
  }>({ displayName: "Member", avatarUrl: null })
  const [publicProfileLoading, setPublicProfileLoading] = useState(false)
  const [publicProfileError, setPublicProfileError] = useState<string | null>(null)
  const [userKitState, setUserKitState] = useState<UserKitState>(emptyUserKitState)
  const [userKitStateLoading, setUserKitStateLoading] = useState(false)
  const [userKitStateSaving, setUserKitStateSaving] = useState(false)
  const [kitStateNotice, setKitStateNotice] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const findLoadMoreRef = useRef<HTMLDivElement>(null)
  const exploreViewportRef = useRef<HTMLElement>(null)
  const [exploreViewportNode, setExploreViewportNode] = useState<HTMLElement | null>(null)
  const exploreEdgeScrollRef = useRef({ dx: 0, dy: 0 })
  const exploreEdgeFrameRef = useRef<number | null>(null)
  const findRequestIdRef = useRef(0)
  const lastLoadedFindQueryKeyRef = useRef(
    buildFindQueryKey({
      search: "",
      decades: [],
      brands: [],
      kitTypes: [],
      colors: [],
    }),
  )

  const { setLeft } = useHeaderSlot()

  useLayoutEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")

    function syncViewport() {
      const wide = media.matches
      if (!wide) {
        setViewMode("find")
      }
      setFindPageSize(wide ? FIND_PAGE_SIZE_DESKTOP : FIND_PAGE_SIZE_MOBILE)
    }

    syncViewport()
    media.addEventListener("change", syncViewport)
    return () => media.removeEventListener("change", syncViewport)
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") {
        return
      }

      const target = event.target
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      if (isTypingTarget) {
        return
      }

      event.preventDefault()
      searchInputRef.current?.focus()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    setCatalogSummary(summary)
  }, [summary])

  useEffect(() => {
    if (!summaryNeedsRefresh || initialRoute !== "home") {
      return
    }

    let isMounted = true

    async function refreshSummary() {
      try {
        const response = await fetch("/api/catalog-summary", {
          cache: "no-store",
        })

        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as CatalogSummary

        if (!isMounted) {
          return
        }

        setCatalogSummary(payload)
      } catch {
        // Keep the fallback summary if the background refresh also fails.
      }
    }

    void refreshSummary()

    return () => {
      isMounted = false
    }
  }, [initialRoute, summaryNeedsRefresh])

  useEffect(() => {
    let isMounted = true

    browserSupabase.auth.getSession().then(({ data, error }) => {
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
    } = browserSupabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null)
      setAuthResolved(true)

      if (!session?.user) {
        setSavedKitEntries([])
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [browserSupabase])

  useEffect(() => {
    if (!currentUser) {
      setSavedKitEntries([])
      setSavedKitEntriesLoading(false)
      setProfileKits([])
      setProfileKitsLoading(false)
      return
    }

    const activeUser = currentUser
    let isMounted = true

    async function loadSavedKitEntries() {
      setSavedKitEntriesLoading(true)

      const { data, error } = await (browserSupabase as any)
        .from("user_kit_states")
        .select("kit_id, owned, wanted, rating")
        .eq("user_id", activeUser.id)
        .order("updated_at", { ascending: false })

      if (!isMounted) {
        return
      }

      if (error) {
        setSavedKitEntries([])
      } else {
        const rows =
          (data as Pick<UserKitStateRow, "kit_id" | "owned" | "wanted" | "rating">[] | null) ??
          []

        setSavedKitEntries(
          rows.map((row) => ({
            kitId: row.kit_id,
            owned: row.owned,
            wanted: row.wanted,
            rating: row.rating,
          })),
        )
      }

      setSavedKitEntriesLoading(false)
    }

    loadSavedKitEntries()

    return () => {
      isMounted = false
    }
  }, [browserSupabase, currentUser])

  useEffect(() => {
    if (!showProfile || !profileUserId) {
      return
    }

    const routeProfileId = profileUserId

    if (currentUser && routeProfileId === currentUser.id) {
      return
    }

    let cancelled = false

    async function loadPublicProfile() {
      setPublicProfileLoading(true)
      setPublicProfileError(null)

      try {
        const response = await fetch(
          `/api/profile/${encodeURIComponent(routeProfileId)}`,
          { cache: "no-store" },
        )

        if (cancelled) {
          return
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string
          }
          setPublicProfileEntries([])
          setPublicProfileError(
            response.status === 404
              ? "We could not find that profile."
              : (payload.error ?? "Could not load this profile."),
          )
          setPublicProfileLoading(false)
          return
        }

        const payload = (await response.json()) as {
          entries: {
            kitId: number
            owned: boolean
            wanted: boolean
            rating: number | null
          }[]
          displayName: string
          avatarUrl: string | null
        }

        if (cancelled) {
          return
        }

        setPublicProfileEntries(
          payload.entries.map((row) => ({
            kitId: row.kitId,
            owned: row.owned,
            wanted: row.wanted,
            rating: row.rating,
          })),
        )
        setPublicProfileMeta({
          displayName: payload.displayName ?? "Member",
          avatarUrl: payload.avatarUrl ?? null,
        })
        setPublicProfileError(null)
      } catch {
        if (!cancelled) {
          setPublicProfileEntries([])
          setPublicProfileError("Could not load this profile.")
        }
      } finally {
        if (!cancelled) {
          setPublicProfileLoading(false)
        }
      }
    }

    void loadPublicProfile()

    return () => {
      cancelled = true
    }
  }, [showProfile, profileUserId, currentUser])

  const isOwnProfile = useMemo(
    () =>
      Boolean(
        showProfile && profileUserId && currentUser && currentUser.id === profileUserId,
      ),
    [showProfile, profileUserId, currentUser],
  )

  const profileViewEntries = useMemo(() => {
    if (showProfile && profileUserId) {
      if (currentUser && profileUserId === currentUser.id) {
        return savedKitEntries
      }
      return publicProfileEntries
    }
    return savedKitEntries
  }, [
    showProfile,
    profileUserId,
    currentUser,
    savedKitEntries,
    publicProfileEntries,
  ])

  useEffect(() => {
    const ids = profileViewEntries.map((entry) => entry.kitId)

    if (ids.length === 0) {
      setProfileKits([])
      setProfileKitsLoading(false)
      return
    }

    let isMounted = true

    async function loadProfileKits() {
      setProfileKitsLoading(true)

      const response = await fetch("/api/kits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ ids }),
      })

      if (!isMounted) {
        return
      }

      if (!response.ok) {
        setProfileKits([])
        setProfileKitsLoading(false)
        return
      }

      const payload = (await response.json()) as { kits?: CatalogKit[] }
      setProfileKits(payload.kits ?? [])
      setProfileKitsLoading(false)
    }

    loadProfileKits()

    return () => {
      isMounted = false
    }
  }, [profileViewEntries])

  useEffect(() => {
    const canvas = exploreViewportRef.current

    if (!canvas || viewMode !== "explore") {
      return
    }

    const centerCanvas = () => {
      canvas.scrollLeft = (canvas.scrollWidth - canvas.clientWidth) / 2
      canvas.scrollTop = (canvas.scrollHeight - canvas.clientHeight) / 2
    }

    const frameOne = window.requestAnimationFrame(centerCanvas)
    const frameTwo = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(centerCanvas)
    })

    return () => {
      window.cancelAnimationFrame(frameOne)
      window.cancelAnimationFrame(frameTwo)
    }
  }, [viewMode])

  useEffect(() => {
    const viewport = exploreViewportRef.current

    if (!viewport || viewMode !== "explore") {
      return
    }

    const stopScrolling = () => {
      exploreEdgeScrollRef.current = { dx: 0, dy: 0 }

      if (exploreEdgeFrameRef.current !== null) {
        window.cancelAnimationFrame(exploreEdgeFrameRef.current)
        exploreEdgeFrameRef.current = null
      }
    }

    const step = () => {
      const { dx, dy } = exploreEdgeScrollRef.current

      if (dx === 0 && dy === 0) {
        exploreEdgeFrameRef.current = null
        return
      }

      viewport.scrollLeft += dx
      viewport.scrollTop += dy
      exploreEdgeFrameRef.current = window.requestAnimationFrame(step)
    }

    const startScrollingIfNeeded = () => {
      if (exploreEdgeFrameRef.current === null) {
        exploreEdgeFrameRef.current = window.requestAnimationFrame(step)
      }
    }

    const handlePointerMove = (event: MouseEvent) => {
      const rect = viewport.getBoundingClientRect()
      /** Wider inset band so panning kicks in well before the literal edge (~center-adjacent). */
      const edgeX = Math.min(Math.max(140, rect.width * 0.32), rect.width * 0.42)
      const edgeY = Math.min(Math.max(140, rect.height * 0.32), rect.height * 0.42)
      const maxSpeed = 18

      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top

      let dx = 0
      let dy = 0

      if (localX >= 0 && localX <= edgeX) {
        dx = -maxSpeed * (1 - localX / edgeX)
      } else if (localX <= rect.width && localX >= rect.width - edgeX) {
        dx = maxSpeed * (1 - (rect.width - localX) / edgeX)
      }

      if (localY >= 0 && localY <= edgeY) {
        dy = -maxSpeed * (1 - localY / edgeY)
      } else if (localY <= rect.height && localY >= rect.height - edgeY) {
        dy = maxSpeed * (1 - (rect.height - localY) / edgeY)
      }

      exploreEdgeScrollRef.current = { dx, dy }

      if (dx !== 0 || dy !== 0) {
        startScrollingIfNeeded()
      } else {
        stopScrolling()
      }
    }

    viewport.addEventListener("mousemove", handlePointerMove)
    viewport.addEventListener("mouseleave", stopScrolling)

    return () => {
      viewport.removeEventListener("mousemove", handlePointerMove)
      viewport.removeEventListener("mouseleave", stopScrolling)
      stopScrolling()
    }
  }, [viewMode])

  useEffect(() => {
    if (!selectedKit) {
      setUserKitState(emptyUserKitState)
      setUserKitStateLoading(false)
      setKitStateNotice(null)
      return
    }

    const viewingSomeoneElseProfile =
      showProfile &&
      profileUserId &&
      (!currentUser || profileUserId !== currentUser.id)

    if (viewingSomeoneElseProfile) {
      const entry = publicProfileEntries.find((e) => e.kitId === selectedKit.id)
      setUserKitState(
        entry
          ? {
              owned: entry.owned,
              wanted: entry.wanted,
              rating: entry.rating,
            }
          : emptyUserKitState,
      )
      setUserKitStateLoading(false)
      setKitStateNotice(null)
      return
    }

    if (!currentUser) {
      setUserKitState(emptyUserKitState)
      setUserKitStateLoading(false)
      setKitStateNotice(null)
      return
    }

    const activeKit = selectedKit
    let isMounted = true

    async function loadUserKitState() {
      setUserKitStateLoading(true)
      setKitStateNotice(null)

      const { data, error } = await (browserSupabase as any)
        .from("user_kit_states")
        .select("owned, wanted, rating")
        .eq("kit_id", activeKit.id)
        .maybeSingle()

      if (!isMounted) {
        return
      }

      if (error) {
        setUserKitState(emptyUserKitState)
        setKitStateNotice("We could not load your saved state for this kit.")
      } else {
        const row = data as Pick<UserKitStateRow, "owned" | "wanted" | "rating"> | null
        setUserKitState({
          owned: row?.owned ?? false,
          wanted: row?.wanted ?? false,
          rating: row?.rating ?? null,
        })
      }

      setUserKitStateLoading(false)
    }

    loadUserKitState()

    return () => {
      isMounted = false
    }
  }, [
    browserSupabase,
    currentUser,
    profileUserId,
    publicProfileEntries,
    selectedKit,
    showProfile,
  ])

  async function loadFindPage({
    offset,
    append,
  }: {
    offset: number
    append: boolean
  }) {
    const requestId = ++findRequestIdRef.current

    if (append) {
      setFindLoadingMore(true)
    } else {
      setFindLoading(true)
    }

    setFindError(null)

    const params = new URLSearchParams()
    if (debouncedSearch) {
      params.set("q", debouncedSearch)
    }

    params.set("limit", String(findPageSizeRef.current))
    params.set("offset", String(offset))

    activeDecades.forEach((decade) => params.append("decade", decade))
    activeBrands.forEach((brand) => params.append("brand", brand))
    activeKitTypes.forEach((kitType) => params.append("kitType", kitType))
    activeColors.forEach((color) => params.append("color", color))

    if (
      isUnfilteredFindQuery(
        debouncedSearch,
        activeDecades,
        activeBrands,
        activeKitTypes,
        activeColors,
      )
    ) {
      params.set("sort", "member_rating")
    }

    try {
      const response = await fetch(`/api/kits?${params.toString()}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("Failed to load catalog results.")
      }

      const payload = (await response.json()) as CatalogPage

      if (requestId !== findRequestIdRef.current) {
        return
      }

      setFindKits((current) => {
        if (!append) {
          return payload.kits
        }

        return [...current, ...payload.kits]
      })
      setFindTotalCount(payload.totalCount)
      setFindHasMore(payload.hasMore)
    } catch (error) {
      if (requestId !== findRequestIdRef.current) {
        return
      }

      setFindError(
        error instanceof Error ? error.message : "Failed to load catalog results.",
      )
      if (!append) {
        setFindKits([])
        setFindTotalCount(0)
        setFindHasMore(false)
      }
    } finally {
      if (requestId === findRequestIdRef.current) {
        setFindLoading(false)
        setFindLoadingMore(false)
      }
    }
  }

  const currentFindQueryKey = useMemo(
    () =>
      buildFindQueryKey({
        search: debouncedSearch,
        decades: activeDecades,
        brands: activeBrands,
        kitTypes: activeKitTypes,
        colors: activeColors,
      }),
    [activeBrands, activeColors, activeDecades, activeKitTypes, debouncedSearch],
  )

  useEffect(() => {
    if (currentFindQueryKey === lastLoadedFindQueryKeyRef.current) {
      return
    }

    lastLoadedFindQueryKeyRef.current = currentFindQueryKey
    void loadFindPage({ offset: 0, append: false })
  }, [currentFindQueryKey])

  const skipInitialMobileCatalogRef = useRef(false)
  useEffect(() => {
    if (!skipInitialMobileCatalogRef.current) {
      skipInitialMobileCatalogRef.current = true
      if (findPageSize === FIND_PAGE_SIZE_MOBILE) {
        return
      }
    }

    void loadFindPage({ offset: 0, append: false })
  }, [findPageSize])

  useEffect(() => {
    const node = findLoadMoreRef.current

    if (!node || !findHasMore || findLoading || findLoadingMore || viewMode !== "find") {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) {
          return
        }

        void loadFindPage({ offset: findKits.length, append: true })
      },
      {
        rootMargin: "600px 0px",
      },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [
    findHasMore,
    findKits.length,
    findLoading,
    findLoadingMore,
    findPageSize,
    viewMode,
  ])

  const kitsById = useMemo(() => {
    const merged = new Map<number, CatalogKit>()

    ;[...findKits, ...exploreKits, ...profileKits].forEach((kit) => {
      merged.set(kit.id, kit)
    })

    return merged
  }, [exploreKits, findKits, profileKits])
  const visibleFindKits = useMemo(() => {
    return findKits.filter(
      (kit) => Boolean(kit.imageUrl) && !brokenImageIds.includes(kit.id),
    )
  }, [brokenImageIds, findKits])

  const currentUserAvatarUrl = useMemo(() => getUserAvatarUrl(currentUser), [currentUser])
  const currentUserDisplayName = useMemo(
    () => getUserDisplayName(currentUser),
    [currentUser],
  )
  const profilePageDisplayName = useMemo(() => {
    if (isOwnProfile && currentUser) {
      return getUserDisplayName(currentUser)
    }
    return publicProfileMeta.displayName
  }, [isOwnProfile, currentUser, publicProfileMeta.displayName])
  const profilePageAvatarUrl = useMemo(() => {
    if (isOwnProfile && currentUser) {
      return getUserAvatarUrl(currentUser)
    }
    return publicProfileMeta.avatarUrl
  }, [isOwnProfile, currentUser, publicProfileMeta.avatarUrl])
  const ownedKits = useMemo(() => {
    return profileViewEntries
      .filter((entry) => entry.owned)
      .map((entry) => kitsById.get(entry.kitId))
      .filter((kit): kit is CatalogKit => Boolean(kit))
  }, [kitsById, profileViewEntries])
  const wantedKits = useMemo(() => {
    return profileViewEntries
      .filter((entry) => entry.wanted)
      .map((entry) => kitsById.get(entry.kitId))
      .filter((kit): kit is CatalogKit => Boolean(kit))
  }, [kitsById, profileViewEntries])
  const ratedKits = useMemo(() => {
    return profileViewEntries
      .filter((entry) => entry.rating !== null)
      .sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0))
      .map((entry) => kitsById.get(entry.kitId))
      .filter((kit): kit is CatalogKit => Boolean(kit))
  }, [kitsById, profileViewEntries])
  const activeProfileSection = useMemo(() => {
    if (profileTab === "owned") {
      return {
        title: "Owned",
        kits: ownedKits,
        emptyMessage: isOwnProfile
          ? "No kits in your owned list yet."
          : "No owned kits yet.",
      }
    }

    if (profileTab === "wanted") {
      return {
        title: "Want",
        kits: wantedKits,
        emptyMessage: isOwnProfile
          ? "No kits in your want list yet."
          : "No wanted kits yet.",
      }
    }

    return {
      title: "Rated",
      kits: ratedKits,
      emptyMessage: isOwnProfile
        ? "You have not rated any kits yet."
        : "No rated kits yet.",
    }
  }, [isOwnProfile, ownedKits, profileTab, ratedKits, wantedKits])

  const orderedBrandOptions = useMemo(
    () => orderFilterOptions(catalogSummary.brands, preferredBrandOrder),
    [catalogSummary.brands],
  )
  const orderedKitTypeOptions = useMemo(
    () => orderFilterOptions(catalogSummary.kitTypes, preferredKitTypeOrder),
    [catalogSummary.kitTypes],
  )

  function openAuthDialog() {
    if (typeof window === "undefined") {
      return
    }

    window.dispatchEvent(new CustomEvent(KIT_ROOM_OPEN_AUTH_EVENT))
  }

  function handleBrokenImage(kitId: number) {
    setBrokenImageIds((current) =>
      current.includes(kitId) ? current : [...current, kitId],
    )
  }

  const handleSignOut = useCallback(async () => {
    await browserSupabase.auth.signOut()
    setUserKitState(emptyUserKitState)
    setSelectedKit(null)
    router.push("/")
  }, [browserSupabase, router])

  async function persistUserKitState(nextState: UserKitState) {
    if (!currentUser || !selectedKit) {
      openAuthDialog()
      return
    }

    const activeKit = selectedKit
    const activeUser = currentUser
    const previousState = userKitState
    setUserKitState(nextState)
    setUserKitStateSaving(true)
    setKitStateNotice(null)

    const shouldDelete =
      !nextState.owned && !nextState.wanted && nextState.rating === null

    const payload: UserKitStateRow = {
      user_id: activeUser.id,
      kit_id: activeKit.id,
      owned: nextState.owned,
      wanted: nextState.wanted,
      rating: nextState.rating,
    }

    const result = shouldDelete
      ? await (browserSupabase as any)
          .from("user_kit_states")
          .delete()
          .eq("user_id", activeUser.id)
          .eq("kit_id", activeKit.id)
      : await (browserSupabase as any)
          .from("user_kit_states")
          .upsert(payload, { onConflict: "user_id,kit_id" })

    if (result.error) {
      setUserKitState(previousState)
      setKitStateNotice("We could not save that change. Please try again.")
    } else {
      setSavedKitEntries((current) => {
        const nextEntries = current.filter((entry) => entry.kitId !== activeKit.id)

        if (shouldDelete) {
          return nextEntries
        }

        return [
          {
            kitId: activeKit.id,
            owned: nextState.owned,
            wanted: nextState.wanted,
            rating: nextState.rating,
          },
          ...nextEntries,
        ]
      })
    }

    setUserKitStateSaving(false)
  }

  function handleOwnedToggle() {
    void persistUserKitState({
      ...userKitState,
      owned: !userKitState.owned,
      wanted: userKitState.owned ? userKitState.wanted : false,
    })
  }

  function handleWantedToggle() {
    void persistUserKitState({
      ...userKitState,
      owned: userKitState.wanted ? userKitState.owned : false,
      wanted: !userKitState.wanted,
    })
  }

  function handleRatingChange(nextRating: number) {
    void persistUserKitState({
      ...userKitState,
      rating: userKitState.rating === nextRating ? null : nextRating,
    })
  }

  useLayoutEffect(() => {
    if (showAbout) {
      setLeft(
        <span className="font-[family-name:var(--font-sans),sans-serif] text-[12px] text-[#1a1a1a]">
          About
        </span>,
      )
      return () => setLeft(null)
    }

    if (showProfile && !authResolved) {
      setLeft(
        <span className="font-[family-name:var(--font-sans),sans-serif] text-[12px] text-[#1a1a1a]">
          Profile
        </span>,
      )
      return () => setLeft(null)
    }

    if (showProfile && currentUser) {
      if (profileUserId && currentUser.id !== profileUserId) {
        setLeft(
          <span className="font-[family-name:var(--font-sans),sans-serif] text-[12px] text-[#1a1a1a]">
            Profile
          </span>,
        )
        return () => setLeft(null)
      }

      setLeft(
        <span className="font-[family-name:var(--font-sans),sans-serif] text-[12px] text-[#1a1a1a]">
          Profile
        </span>,
      )
      return () => setLeft(null)
    }

    if (showProfile && !currentUser) {
      setLeft(
        <span className="font-[family-name:var(--font-sans),sans-serif] text-[12px] text-[#1a1a1a]">
          Profile
        </span>,
      )
      return () => setLeft(null)
    }

    setLeft(
      <>
        <div className="inline-flex min-w-0 max-w-full shrink items-center overflow-hidden rounded-full border border-[var(--line)] bg-[#fafafa] p-0.5 text-[12px] leading-none md:hidden">
          <button
            type="button"
            onClick={() => setViewMode("find")}
            className={`shrink-0 rounded-full px-2.5 py-1.5 transition ${
              viewMode === "find"
                ? "bg-[#111] text-white"
                : "text-[var(--muted)]"
            }`}
          >
            Find
          </button>
          <button
            type="button"
            onClick={() => setViewMode("explore")}
            className={`shrink-0 rounded-full px-2.5 py-1.5 transition ${
              viewMode === "explore"
                ? "bg-[#111] text-white"
                : "text-[var(--muted)]"
            }`}
          >
            Explore
          </button>
        </div>
        <div className="hidden items-center rounded-full border border-[var(--line)] bg-[#fafafa] p-1 text-[13px] md:inline-flex">
          <button
            type="button"
            onClick={() => setViewMode("find")}
            className={`rounded-full px-3 py-1 transition ${
              viewMode === "find"
                ? "bg-[#111] text-white"
                : "text-[var(--muted)]"
            }`}
          >
            Find
          </button>
          <button
            type="button"
            onClick={() => setViewMode("explore")}
            className={`rounded-full px-3 py-1 transition ${
              viewMode === "explore"
                ? "bg-[#111] text-white"
                : "text-[var(--muted)]"
            }`}
          >
            Explore
          </button>
        </div>
      </>,
    )
    return () => setLeft(null)
  }, [
    showAbout,
    showProfile,
    authResolved,
    currentUser,
    profileUserId,
    viewMode,
    setLeft,
    setViewMode,
  ])

  if (showAbout) {
    return (
      <main className="min-h-screen bg-white pb-20">
        <section className="mx-auto max-w-3xl px-4 pb-12 pt-20 sm:px-6 lg:px-8">
          <div className="slide-up space-y-8">
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#9a9a9a]">
                About
              </p>
              <h1 className="text-5xl font-light tracking-[-0.05em] text-[#111] sm:text-6xl">
                The Kit Room
              </h1>
            </div>

            <div className="space-y-6 text-[15px] leading-8 text-[#555]">
              <p>
                Football jerseys have crossed over from the pitch into fashion.
                Worn on the street, collected as artifacts, and treated as design
                objects in their own right. Understanding their history matters
                more than ever.
              </p>
              <p>
                The Kit Room is a visualization and directory for exploring some
                of the best kits ever made - a browseable archive built for people
                who care about the craft behind the shirt.
              </p>
              <p>
                Data is sourced primarily from{" "}
                <a
                  href="https://www.footballkitarchive.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-normal underline decoration-[1px] underline-offset-4"
                  style={{ textDecoration: "underline" }}
                >
                  footballkitarchive.com
                </a>
                .
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-[13px] text-[#555] underline underline-offset-4"
            >
              Back to collection
            </button>
          </div>
        </section>
      </main>
    )
  }

  if (showProfile && !authResolved) {
    return (
      <main className="min-h-screen bg-white pb-20">
        <p className="mx-auto max-w-6xl px-4 pt-20 text-[14px] text-[#777] sm:px-6 lg:px-8">
          Loading profile…
        </p>
      </main>
    )
  }

  if (showProfile && profileUserId) {
    const profileListLoading = isOwnProfile
      ? savedKitEntriesLoading || profileKitsLoading
      : publicProfileLoading || profileKitsLoading

    return (
      <main className="min-h-screen bg-white pb-20">
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 lg:px-8">
          <div className="space-y-10">
            <div
              className={`grid w-full min-w-0 items-start gap-x-4 [grid-template-columns:44px_minmax(0,1fr)] ${
                isOwnProfile ? "gap-y-2.5" : "gap-y-0"
              }`}
            >
              {profilePageAvatarUrl ? (
                <img
                  src={getImageProxyUrl(profilePageAvatarUrl)}
                  alt={`${profilePageDisplayName} profile`}
                  className="shrink-0 rounded-full object-cover"
                  style={{ width: "44px", height: "44px" }}
                />
              ) : (
                <div
                  className="flex shrink-0 items-center justify-center rounded-full bg-[#f2f2f2] text-[14px] uppercase text-[#777]"
                  style={{ width: "44px", height: "44px" }}
                >
                  {profilePageDisplayName.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 space-y-1">
                <h1 className="text-3xl font-light tracking-[-0.04em] text-[#111]">
                  {profilePageDisplayName}
                </h1>
                <p className="text-[14px] text-[#888]">
                  {formatCount(ratedKits.length)} rated · {formatCount(ownedKits.length)} owned ·{" "}
                  {formatCount(wantedKits.length)} want
                </p>
              </div>

              {isOwnProfile ? (
                <>
                  <div className="w-11 shrink-0" aria-hidden />
                  <div className="self-start">
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="inline-flex items-center rounded border border-[var(--line)] bg-white px-2 py-0.5 font-[family-name:var(--font-sans),sans-serif] transition hover:border-[#d8d8d8] hover:bg-[#fafafa]"
                    >
                      <span className="text-[11px] font-normal leading-none text-[#666] transition hover:text-[#333]">
                        Sign out
                      </span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>

            {publicProfileError && !isOwnProfile ? (
              <p className="text-[14px] text-[#b45353]">{publicProfileError}</p>
            ) : null}

            {profileListLoading ? (
              <p className="text-[14px] text-[#777]">
                {isOwnProfile ? "Loading your saved kits..." : "Loading kits..."}
              </p>
            ) : (
              <div className="space-y-8">
                <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-[#fafafa] p-1 text-[13px]">
                  <button
                    type="button"
                    onClick={() => setProfileTab("rated")}
                    className={`rounded-full px-3 py-1 transition ${
                      profileTab === "rated"
                        ? "bg-[#111] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    Rated
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileTab("owned")}
                    className={`rounded-full px-3 py-1 transition ${
                      profileTab === "owned"
                        ? "bg-[#111] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    Own
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileTab("wanted")}
                    className={`rounded-full px-3 py-1 transition ${
                      profileTab === "wanted"
                        ? "bg-[#111] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    Want
                  </button>
                </div>

                <ProfileSection
                  key={profileTab}
                  title={activeProfileSection.title}
                  kits={activeProfileSection.kits}
                  emptyMessage={activeProfileSection.emptyMessage}
                  onSelect={setSelectedKit}
                  onImageError={handleBrokenImage}
                />
              </div>
            )}
          </div>
        </section>

        <KitModal
          kit={selectedKit}
          currentUser={currentUser}
          userKitState={userKitState}
          userKitStateLoading={userKitStateLoading}
          userKitStateSaving={userKitStateSaving}
          kitStateNotice={kitStateNotice}
          onAuthRequest={openAuthDialog}
          onToggleOwned={handleOwnedToggle}
          onToggleWanted={handleWantedToggle}
          onRatingChange={handleRatingChange}
          onClose={() => setSelectedKit(null)}
          readOnly={!isOwnProfile}
        />
      </main>
    )
  }

  return (
    <main
      className={
        viewMode === "find"
          ? "min-h-screen bg-white pb-20"
          : "min-h-screen bg-white"
      }
    >
      {viewMode === "find" ? (
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-2 sm:px-6 sm:pt-8 md:pt-16 lg:px-8">
          <div className="fade-in flex flex-col">
            <div className="slide-up order-1 w-full md:order-2 md:mt-8">
              <div className="mx-auto flex justify-center">
                <div className="relative isolate w-full max-w-[34rem]">
                  <span
                    className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 flex w-12 items-center justify-center text-[#888]"
                    aria-hidden
                  >
                    <span className="text-[24px] leading-none">⌕</span>
                  </span>
                  <input
                    ref={searchInputRef}
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                    }}
                    placeholder="Search clubs, years, brands..."
                    className="relative z-0 w-full rounded-[8px] border border-[var(--line)] bg-white py-[0.625rem] pl-12 pr-[3.25rem] text-[14px] text-[#555] outline-none transition placeholder:text-[14px] focus:border-[#d3d3d3]"
                  />
                  <div className="absolute bottom-0 right-0 top-0 z-10 flex items-center pr-2">
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[17px] leading-none text-[#9a9a9a] transition hover:bg-[#f0f0f0] hover:text-[#555]"
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    ) : (
                      <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded border border-[#ebebeb] bg-[#f5f5f5] px-1.5 text-[11px] font-medium leading-none text-[#9a9a9a]">
                        /
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="order-2 mx-auto mt-6 max-w-3xl text-center md:order-1 md:mt-0">
              <h1 className="text-5xl font-light tracking-[-0.05em] text-[#111] sm:text-6xl">
                The Kit Room
              </h1>
              <p className="mt-5 text-[14px] text-[var(--muted)]">
                {formatCount(catalogSummary.teamsCount)} teams · {formatCount(catalogSummary.kitsCount)} kits
              </p>
            </div>

            <div className="filter-controls slide-up order-3 mx-auto mt-4 flex w-full min-w-0 max-w-full justify-stretch md:mt-6 md:max-w-none md:justify-center">
              <div className="w-full min-w-0 max-w-full lg:w-auto">
                {/*
                  Mobile: 2×2 (Decade | Brand / Type | Color) + full-width reset.
                  md–lg: 2-column grid; lg+: 4 filter columns + reset.
                */}
                <div className="mx-auto grid w-full min-w-0 max-w-full grid-cols-2 gap-x-3 gap-y-2.5 text-left max-md:max-w-md max-md:mx-auto md:max-w-[30rem] md:gap-2 lg:max-w-none lg:grid-cols-[repeat(4,11rem)_minmax(0,auto)] lg:gap-2">
                  <MultiSelectDropdown
                    className="min-w-0"
                    label="Decade"
                    placeholder="All Decades"
                    options={catalogSummary.decades}
                    selected={activeDecades}
                    onChange={setActiveDecades}
                  />

                  <MultiSelectDropdown
                    className="min-w-0"
                    label="Brand"
                    placeholder="All Brands"
                    options={orderedBrandOptions}
                    selected={activeBrands}
                    onChange={setActiveBrands}
                  />

                  <MultiSelectDropdown
                    className="min-w-0"
                    label="Kit Type"
                    placeholder="All Types"
                    options={orderedKitTypeOptions}
                    selected={activeKitTypes}
                    onChange={setActiveKitTypes}
                  />

                  <MultiSelectDropdown
                    className="min-w-0"
                    label="Color"
                    placeholder="All Colors"
                    options={colorOptions.map((option) => option.name)}
                    selected={activeColors}
                    onChange={setActiveColors}
                  />

                  <div className="col-span-2 flex w-full items-end justify-center pt-1 md:items-center md:pt-[10px] lg:col-span-1 lg:justify-start lg:pt-[18px]">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDecades([])
                        setActiveBrands([])
                        setActiveKitTypes([])
                        setActiveColors([])
                      }}
                      className="inline-flex h-[1.85rem] cursor-pointer items-center whitespace-nowrap rounded-lg px-0 font-normal text-[#777] underline decoration-[0.5px] underline-offset-2 md:pb-2"
                      style={{
                        all: "unset",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        fontFamily: "var(--font-sans), sans-serif",
                        fontSize: "11px",
                        fontWeight: 400,
                        lineHeight: "1.2",
                        color: "#777",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                      }}
                    >
                      <span className="md:hidden">Reset</span>
                      <span className="hidden md:inline">Reset filters</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {findError ? (
            <p className="mx-auto mt-12 max-w-3xl text-center text-[14px] text-[#9a9a9a]">
              {findError}
            </p>
          ) : null}

          {findLoading && visibleFindKits.length === 0 ? (
            <FindGridSkeleton />
          ) : (
            <>
              <KitGrid
                kits={visibleFindKits}
                onSelect={setSelectedKit}
                onImageError={handleBrokenImage}
              />

              {!findLoadingMore && visibleFindKits.length === 0 ? (
                <p className="mx-auto mt-12 max-w-3xl text-center text-[14px] text-[#9a9a9a]">
                  No kits found
                </p>
              ) : null}

              <div ref={findLoadMoreRef} className="h-8 w-full" />

              {findLoadingMore ? (
                <p className="mx-auto mt-4 max-w-3xl text-center text-[13px] text-[#9a9a9a]">
                  Loading more kits...
                </p>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <section
          ref={(node) => {
            exploreViewportRef.current = node
            setExploreViewportNode(node)
          }}
          className="h-[calc(100vh-3.5rem)] overflow-auto bg-white hide-scrollbar"
        >
          <div className="w-max px-12 py-12">
            <div
              className="grid w-max auto-rows-max items-start gap-x-16 gap-y-20 overflow-visible px-3 py-6"
              style={{
                gridTemplateColumns: "repeat(31, 11.4rem)",
              }}
            >
              {exploreKits.map((kit) => {
                const showKit =
                  typeof kit.imageUrl === "string" &&
                  kit.imageUrl.trim().length > 0 &&
                  !brokenImageIds.includes(kit.id)

                return (
                  <div
                    key={kit.id}
                    className="min-w-0 overflow-visible"
                    style={exploreScatterStyle(kit.id)}
                  >
                    {showKit ? (
                      <CatalogKitCard
                        kit={kit}
                        onSelect={setSelectedKit}
                        onImageError={handleBrokenImage}
                        viewportRoot={exploreViewportNode}
                        isExploreGrid
                      />
                    ) : (
                      <ExploreGridPlaceholder />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <KitModal
        kit={selectedKit}
        currentUser={currentUser}
        userKitState={userKitState}
        userKitStateLoading={userKitStateLoading}
        userKitStateSaving={userKitStateSaving}
        kitStateNotice={kitStateNotice}
        onAuthRequest={openAuthDialog}
        onToggleOwned={handleOwnedToggle}
        onToggleWanted={handleWantedToggle}
        onRatingChange={handleRatingChange}
        onClose={() => setSelectedKit(null)}
      />
    </main>
  )
}

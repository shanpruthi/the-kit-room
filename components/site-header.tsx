"use client"

import type { ReactNode } from "react"
import { SiteNav } from "@/components/site-nav"

type SiteHeaderProps = {
  left?: ReactNode
}

export function SiteHeader({ left }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 text-sm sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-4">{left}</div>
        <SiteNav />
      </div>
    </header>
  )
}

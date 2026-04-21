"use client"

import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site-header"
import { useHeaderSlot } from "@/components/header-slot"

export function AppChrome({ children }: { children: ReactNode }) {
  const { left } = useHeaderSlot()

  return (
    <>
      <SiteHeader left={left} />
      {children}
    </>
  )
}

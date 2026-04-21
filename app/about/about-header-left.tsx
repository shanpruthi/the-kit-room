"use client"

import { useLayoutEffect } from "react"
import { useHeaderSlot } from "@/components/header-slot"

export function AboutHeaderLeft() {
  const { setLeft } = useHeaderSlot()

  useLayoutEffect(() => {
    setLeft(
      <span className="font-[family-name:var(--font-sans),sans-serif] text-[12px] text-[#1a1a1a]">
        About
      </span>,
    )
    return () => setLeft(null)
  }, [setLeft])

  return null
}

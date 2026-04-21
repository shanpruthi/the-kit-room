"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type HeaderSlotContextValue = {
  left: ReactNode | null
  setLeft: (node: ReactNode | null) => void
}

const HeaderSlotContext = createContext<HeaderSlotContextValue | null>(null)

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [left, setLeftState] = useState<ReactNode | null>(null)

  const setLeft = useCallback((node: ReactNode | null) => {
    setLeftState(node)
  }, [])

  const value = useMemo(() => ({ left, setLeft }), [left, setLeft])

  return (
    <HeaderSlotContext.Provider value={value}>
      {children}
    </HeaderSlotContext.Provider>
  )
}

export function useHeaderSlot() {
  const ctx = useContext(HeaderSlotContext)
  if (!ctx) {
    throw new Error("useHeaderSlot must be used within HeaderSlotProvider")
  }
  return ctx
}

"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export function AuthDialog({
  isOpen,
  message,
  error,
  isSubmitting,
  onClose,
  onGoogleAuth,
}: {
  isOpen: boolean
  message: string | null
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onGoogleAuth: () => void
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen || !mounted) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-[12px] border border-[var(--line)] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p
              id="auth-dialog-title"
              className="text-[10px] uppercase tracking-[0.18em] text-[#9a9a9a]"
            >
              Account
            </p>
            <p className="text-[13px] leading-6 text-[#666]">
              Sign up with Google to save what you own, track what you want, and
              rate kits across the archive.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--line)] px-3 py-1 text-[12px] text-[#666]"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {message ? (
            <p className="rounded-[8px] bg-[#f6f6f6] px-3 py-2 text-[12px] leading-5 text-[#666]">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="rounded-[8px] bg-[#fff3f1] px-3 py-2 text-[12px] leading-5 text-[#b34d39]">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onGoogleAuth}
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#111] px-4 py-2.5 text-[13px] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Redirecting to Google..." : "Login / Sign up"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

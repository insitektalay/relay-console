"use client"

import { useEffect, useState } from "react"

export function usePersistentSelection(key: string) {
  const [value, setValue] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(key),
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    if (!value) {
      window.localStorage.removeItem(key)
      return
    }

    window.localStorage.setItem(key, value)
  }, [key, value])

  return [value, setValue] as const
}

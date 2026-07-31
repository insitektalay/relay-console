"use client"

import { useEffect, useState } from "react"

function readPersistentStringMap(key: string) {
  if (typeof window === "undefined") {
    return {}
  }

  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
      )
    )
  } catch {
    return {}
  }
}

export function usePersistentStringMap(key: string) {
  const [value, setValue] = useState<Record<string, string>>(() =>
    readPersistentStringMap(key)
  )

  useEffect(() => {
    setValue(readPersistentStringMap(key))
  }, [key])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    if (!Object.keys(value).length) {
      window.localStorage.removeItem(key)
      return
    }

    window.localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}

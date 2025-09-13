"use client"

import { useEffect, useState } from "react"

export function useDarkMode(defaultValue = false) {
  const [isDark, setIsDark] = useState(defaultValue)

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [isDark])

  return { isDark, toggle: () => setIsDark((v) => !v), setIsDark }
}

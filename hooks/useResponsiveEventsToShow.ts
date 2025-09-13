"use client"

import { useEffect, useState } from "react"

export function useResponsiveEventsToShow() {
  const [isSm, setIsSm] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const handler = () => setIsSm(mq.matches)
    handler()
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return isSm ? 1 : 2
}

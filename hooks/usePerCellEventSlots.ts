"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type SlotsConfig = {
  headerHeight: number
  eventHeight: number
  gap: number
}

export function usePerCellEventSlots() {
  const cellsRef = useRef<Map<number, HTMLElement>>(new Map())
  const [eventProbeHeight, setEventProbeHeight] = useState<number>(18)
  const [cellHeights, setCellHeights] = useState<Map<number, number>>(
    () => new Map()
  )

  const registerCell = useCallback((idx: number, el: HTMLElement | null) => {
    const map = cellsRef.current
    if (el) map.set(idx, el)
    else map.delete(idx)
  }, [])

  const registerEventProbe = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    // Measure once mounted
    const h = el.getBoundingClientRect().height || 18
    setEventProbeHeight(h)
  }, [])

  // Observe cell size changes (ResizeObserver)
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver((entries) => {
      const next = new Map(cellHeights)
      entries.forEach((e) => {
        const el = e.target as HTMLElement
        const idxAttr = el.getAttribute("data-cell-index")
        if (!idxAttr) return
        const idx = Number(idxAttr)
        next.set(idx, el.clientHeight)
      })
      setCellHeights(next)
    })

    cellsRef.current.forEach((el) => ro.observe(el))
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fallback: initial measure on mount/resize
  useEffect(() => {
    const measure = () => {
      const next = new Map<number, number>()
      cellsRef.current.forEach((el, idx) => {
        next.set(idx, el.clientHeight)
      })
      setCellHeights(next)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  const getSlotsForIndex = useCallback(
    (idx: number, cfg: SlotsConfig) => {
      const ch = cellHeights.get(idx)
      if (!ch) return 3
      const available = Math.max(0, ch - cfg.headerHeight)
      const row = Math.max(1, Math.round(cfg.eventHeight + cfg.gap))
      const slots = Math.floor(available / row)
      // Ensure at least 1 fits visually
      return Math.max(1, slots)
    },
    [cellHeights]
  )

  return {
    registerCell,
    getSlotsForIndex,
    registerEventProbe,
    eventProbeHeight,
  }
}

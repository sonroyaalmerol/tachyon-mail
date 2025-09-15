"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { dayNames } from "@/lib/calendar/constants"
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  isSameDay,
} from "@/lib/calendar/utils"
import type { CalendarEvent } from "@/lib/calendar/types"
import { cn } from "@/lib/utils"
import {
  getMonthCellsWithNulls,
  getVisibleCellsForMode,
  moveIndexByArrow,
} from "@/lib/calendar/gridHelpers"
import { usePerCellEventSlots } from "@/hooks/usePerCellEventSlots"
import { parseTimeToMinutes } from "@/lib/calendar/time"

type ViewMode = "month" | "week"

export function CalendarGrid({
  date,
  events,
  eventSearchQuery,
  selectedEventColor,
  onDayClickAction,
  onEventClickAction,
  getEventColorClassAction,
  viewMode = "month",
}: {
  date: Date
  events: CalendarEvent[]
  eventSearchQuery: string
  selectedEventColor: string
  onDayClickAction: (day: number) => void
  onEventClickAction: (ev: CalendarEvent, e: React.MouseEvent) => void
  getEventColorClassAction: (c: string) => string
  viewMode?: ViewMode
}) {
  const daysInMonth = getDaysInMonth(date)
  const firstDay = getFirstDayOfMonth(date)

  const allCells = useMemo(
    () => getMonthCellsWithNulls(daysInMonth, firstDay),
    [daysInMonth, firstDay]
  )

  const todayIndex = useMemo(() => {
    const today = new Date()
    const sameMonth =
      today.getFullYear() === date.getFullYear() &&
      today.getMonth() === date.getMonth()
    if (!sameMonth) return -1
    return firstDay + today.getDate() - 1
  }, [date, firstDay])

  const [currentIndex, setCurrentIndex] = useState<number>(() =>
    todayIndex >= 0 ? todayIndex : 0
  )

  useEffect(() => {
    if (currentIndex >= allCells.length) {
      setCurrentIndex(Math.max(0, allCells.length - 1))
    }
  }, [allCells.length, currentIndex])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  const {
    registerCell,
    getSlotsForIndex,
    registerEventProbe,
    eventProbeHeight,
  } = usePerCellEventSlots()

  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  const toggleExpandDay = (day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  const filterAndSortEvents = (day: number | null) => {
    if (!day) return []
    let dayEvents = events.filter((ev) => ev.date === day)
    if (eventSearchQuery) {
      const q = eventSearchQuery.toLowerCase()
      dayEvents = dayEvents.filter(
        (ev) =>
          ev.title.toLowerCase().includes(q) ||
          (ev.description && ev.description.toLowerCase().includes(q))
      )
    }
    if (selectedEventColor !== "all") {
      dayEvents = dayEvents.filter((ev) => ev.color === selectedEventColor)
    }
    dayEvents.sort((a, b) => {
      const aAll = a.isAllDay ? 0 : 1
      const bAll = b.isAllDay ? 0 : 1
      if (aAll !== bAll) return aAll - bAll
      return (parseTimeToMinutes(a.time) ?? 0) - (parseTimeToMinutes(b.time) ?? 0)
    })
    return dayEvents
  }

  const visibleCells = useMemo(() => {
    return getVisibleCellsForMode({
      allCells,
      mode: viewMode,
      currentIndex,
    })
  }, [allCells, currentIndex, viewMode])

  const handleArrowNav = (
    e: React.KeyboardEvent<HTMLDivElement>,
    idx: number
  ) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
      return
    e.preventDefault()
    const next = moveIndexByArrow({
      key: e.key,
      from: idx,
      columns: 7,
      max: allCells.length,
    })
    setCurrentIndex(next)
    requestAnimationFrame(() => {
      const cell = document.querySelector<HTMLElement>(
        `[data-cell-index="${next}"]`
      )
      cell?.focus()
    })
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={(e) => setScrolled((e.target as HTMLDivElement).scrollTop > 0)}
        className="h-full p-2 md:p-6 overflow-auto will-change-transform"
      >
        <div className="bg-card rounded-lg border border-border min-h-full overflow-hidden">
          {/* Weekday header */}
          <div
            className={cn(
              "grid grid-cols-7 border-b border-border sticky top-0 bg-card z-10 transition-shadow",
              scrolled ? "shadow-sm" : "shadow-none"
            )}
          >
            {dayNames.map((day) => (
              <div
                key={day}
                className="p-1 md:p-3 text-center text-xs md:text-sm font-medium text-muted-foreground bg-muted/30 min-h-[32px] md:min-h-[40px] flex items-center justify-center select-none"
                aria-label={day}
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.slice(0, 1)}</span>
              </div>
            ))}
          </div>

          {/* Month / Week grid */}
          <div
            className="
              grid grid-cols-7
              [--cell-min:56px] sm:[--cell-min:84px] md:[--cell-min:120px]
              auto-rows-[minmax(var(--cell-min),_1fr)]
            "
            role="grid"
            aria-label={viewMode === "week" ? "Week view" : "Month view"}
          >
            {visibleCells.map(({ idx, day }) => {
              const dayEvents = filterAndSortEvents(day)
              const isToday = day ? isSameDay(date, day) : false

              const slots = getSlotsForIndex(idx, {
                headerHeight: 28, // px reserved for date/add area
                eventHeight: eventProbeHeight || 18,
                gap: 4,
              })

              const isExpanded = !!(day && expandedDays.has(day))
              const visibleEvents = isExpanded
                ? dayEvents
                : dayEvents.slice(0, slots)
              const hiddenCount = Math.max(0, dayEvents.length - visibleEvents.length)

              return (
                <div
                  key={idx}
                  data-cell-index={idx}
                  ref={(el) => registerCell(idx, el as HTMLElement | null)}
                  role={day ? "gridcell" : "presentation"}
                  aria-selected={isToday || undefined}
                  tabIndex={day ? (idx === currentIndex ? 0 : -1) : -1}
                  onKeyDown={(e) => {
                    if (!day) return
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onDayClickAction(day)
                    } else {
                      handleArrowNav(e, idx)
                    }
                  }}
                  onClick={() => day && onDayClickAction(day)}
                  className={cn(
                    "border-r border-b border-border p-1 md:p-2 overflow-hidden outline-none",
                    day ? "cursor-pointer" : "bg-muted/20",
                    isToday ? "bg-primary/5 border-primary/20" : "",
                    "focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                  )}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between gap-1 mb-1 text-xs md:text-sm font-medium">
                        <div
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-md",
                            isToday
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground"
                          )}
                        >
                          {day}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDayClickAction(day)
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted/60 active:scale-[0.98] transition md:hidden"
                          aria-label="Add event"
                        >
                          +
                        </button>
                      </div>

                      <div className="space-y-0.5 overflow-hidden relative">
                        <div
                          ref={registerEventProbe}
                          className="invisible absolute -z-10 text-xs p-0.5 md:p-1 rounded"
                        >
                          Probe
                        </div>

                        {visibleEvents.map((ev) => (
                          <button
                            key={ev.id}
                            onClick={(e) => onEventClickAction(ev, e)}
                            className={cn(
                              "w-full text-left text-xs p-0.5 md:p-1 rounded truncate",
                              "hover:opacity-90 active:scale-[0.99] transition",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                              getEventColorClassAction(ev.color)
                            )}
                          >
                            <div className="font-medium leading-tight truncate">
                              {ev.title}
                            </div>
                            <div className="opacity-90 hidden md:block truncate">
                              {ev.isAllDay ? "All day" : ev.time}
                            </div>
                          </button>
                        ))}

                        {hiddenCount > 0 && !isExpanded && (
                          <button
                            className="text-xs text-muted-foreground p-0.5 underline underline-offset-2 hover:text-foreground transition"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpandDay(day)
                            }}
                            aria-label={`Show ${hiddenCount} more events`}
                          >
                            +{hiddenCount} more
                          </button>
                        )}

                        {isExpanded && hiddenCount > 0 && (
                          <button
                            className="text-xs text-muted-foreground p-0.5 underline underline-offset-2 hover:text-foreground transition"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleExpandDay(day)
                            }}
                            aria-label="Show fewer events"
                          >
                            Show less
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

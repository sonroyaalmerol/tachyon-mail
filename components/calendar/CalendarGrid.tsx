"use client"

import { dayNames } from "@/lib/calendar/constants"
import { getDaysInMonth, getFirstDayOfMonth, isSameDay } from "@/lib/calendar/utils"
import { CalendarEvent } from "@/lib/calendar/types"
import { useMemo } from "react"
import { useResponsiveEventsToShow } from "@/hooks/useResponsiveEventsToShow"

export function CalendarGrid({
  date,
  events,
  eventSearchQuery,
  selectedEventColor,
  onDayClickAction,
  onEventClickAction,
  getEventColorClassAction,
}: {
  date: Date
  events: CalendarEvent[]
  eventSearchQuery: string
  selectedEventColor: string
  onDayClickAction: (day: number) => void
  onEventClickAction: (ev: CalendarEvent, e: React.MouseEvent) => void
  getEventColorClassAction: (c: string) => string
}) {
  const daysInMonth = getDaysInMonth(date)
  const firstDay = getFirstDayOfMonth(date)
  const eventsToShow = useResponsiveEventsToShow()

  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [firstDay, daysInMonth])

  const filterEvents = (day: number | null) => {
    if (!day) return []
    let dayEvents = events.filter((ev) => ev.date === day)
    if (eventSearchQuery) {
      const q = eventSearchQuery.toLowerCase()
      dayEvents = dayEvents.filter(
        (ev) =>
          ev.title.toLowerCase().includes(q) || (ev.description && ev.description.toLowerCase().includes(q))
      )
    }
    if (selectedEventColor !== "all") {
      dayEvents = dayEvents.filter((ev) => ev.color === selectedEventColor)
    }
    return dayEvents
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full p-2 md:p-6 overflow-auto">
        <div className="bg-card rounded-lg border border-border min-h-full overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border sticky top-0 bg-card z-10">
            {dayNames.map((day) => (
              <div
                key={day}
                className="p-1 md:p-3 text-center text-xs md:text-sm font-medium text-muted-foreground bg-muted/30 min-h-[32px] md:min-h-[40px] flex items-center justify-center"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.slice(0, 1)}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarCells.map((day, idx) => {
              const dayEvents = filterEvents(day)
              return (
                <div
                  key={idx}
                  onClick={() => day && onDayClickAction(day)}
                  className={`border-r border-b border-border p-1 md:p-2 min-h-[60px] md:min-h-[120px] hover:bg-muted/20 transition-colors overflow-hidden ${day ? "cursor-pointer" : ""
                    } ${isSameDay(date, day ?? -1) ? "bg-primary/5 border-primary/20" : ""}`}
                >
                  {day && (
                    <>
                      <div
                        className={`text-xs md:text-sm font-medium mb-1 ${isSameDay(date, day) ? "text-primary font-semibold" : "text-foreground"
                          }`}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, eventsToShow).map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => onEventClickAction(ev, e)}
                            className={`text-xs p-0.5 md:p-1 rounded truncate cursor-pointer hover:opacity-80 transition-opacity ${getEventColorClassAction(
                              ev.color
                            )}`}
                          >
                            <div className="font-medium leading-tight truncate">{ev.title}</div>
                            <div className="opacity-90 hidden md:block truncate">{ev.time}</div>
                          </div>
                        ))}
                        {dayEvents.length > eventsToShow && (
                          <div className="text-xs text-muted-foreground p-0.5">
                            +{dayEvents.length - eventsToShow} more
                          </div>
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

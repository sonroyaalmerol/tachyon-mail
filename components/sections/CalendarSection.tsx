"use client"

import { useState } from "react"
import { CalendarHeader } from "@/components/calendar/CalendarHeader"
import { CalendarGrid } from "@/components/calendar/CalendarGrid"
import { EventDialog } from "@/components/calendar/EventDialog"
import { CalendarEvent, CalendarViewMode } from "@/lib/calendar/types"
import { eventColors } from "@/lib/calendar/constants"
import { useShell } from "@/components/common/ShellContext"

export function CalendarSection() {
  const { openSidebar } = useShell()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarViewMode, setCalendarViewMode] =
    useState<CalendarViewMode>("month")
  const [eventSearchQuery, setEventSearchQueryAction] = useState("")
  const [selectedEventColor, setSelectedEventColorAction] =
    useState<string>("all")

  const [events, setEvents] = useState<CalendarEvent[]>([
    { id: 1, title: "Team Meeting", date: 15, time: "10:00", description: "Weekly team sync", color: "primary" },
    { id: 2, title: "Project Review", date: 18, time: "14:00", description: "Q4 project review", color: "success" },
    { id: 3, title: "Client Call", date: 22, time: "15:30", description: "Client presentation", color: "info" },
    { id: 4, title: "Deadline", date: 25, time: "23:59", description: "Project deadline", color: "danger" },
  ])

  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const navigateMonth = (dir: "prev" | "next") => {
    setCurrentDate((prev) => {
      const d = new Date(prev)
      d.setMonth(prev.getMonth() + (dir === "prev" ? -1 : 1))
      return d
    })
  }

  const getEventColorClassAction = (colorValue: string) => {
    const colorConfig = eventColors.find((c) => c.value === colorValue)
    return colorConfig ? colorConfig.class : "bg-primary text-primary-foreground"
  }

  const onCreateEventAction = () => {
    const today = new Date().getDate()
    setSelectedDay(today)
    setSelectedEvent(null)
    setIsEventModalOpen(true)
  }

  const onDayClickAction = (day: number) => {
    setSelectedDay(day)
    setSelectedEvent(null)
    setIsEventModalOpen(true)
  }

  const onEventClickAction = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedEvent(event)
    setSelectedDay(event.date)
    setIsEventModalOpen(true)
  }

  const onSaveActionEvent = (payload: Omit<CalendarEvent, "id"> & { id?: number }) => {
    if (payload.id) {
      setEvents((prev) => prev.map((ev) => (ev.id === payload.id ? { id: payload.id!, ...payload } : ev)))
    } else {
      setEvents((prev) => [...prev, { id: Date.now(), ...payload }])
    }
    setIsEventModalOpen(false)
    setSelectedEvent(null)
    setSelectedDay(null)
  }

  const onDeleteActionEvent = () => {
    if (!selectedEvent) return
    setEvents((prev) => prev.filter((ev) => ev.id !== selectedEvent.id))
    setIsEventModalOpen(false)
    setSelectedEvent(null)
    setSelectedDay(null)
  }

  return (
    <>
      <CalendarHeader
        currentDate={currentDate}
        onPrevMonthAction={() => navigateMonth("prev")}
        onNextMonthAction={() => navigateMonth("next")}
        onTodayAction={() => setCurrentDate(new Date())}
        onOpenSidebarAction={openSidebar}
        viewMode={calendarViewMode}
        setViewModeAction={setCalendarViewMode}
        selectedEventColor={selectedEventColor}
        setSelectedEventColorAction={setSelectedEventColorAction}
        eventSearchQuery={eventSearchQuery}
        setEventSearchQueryAction={setEventSearchQueryAction}
        onCreateEventAction={onCreateEventAction}
      />

      <CalendarGrid
        date={currentDate}
        events={events}
        eventSearchQuery={eventSearchQuery}
        selectedEventColor={selectedEventColor}
        onDayClickAction={onDayClickAction}
        onEventClickAction={onEventClickAction}
        getEventColorClassAction={getEventColorClassAction}
      />

      <EventDialog
        open={isEventModalOpen}
        onOpenChangeAction={setIsEventModalOpen}
        selectedDay={selectedDay}
        currentDate={currentDate}
        selectedEvent={selectedEvent}
        onDeleteAction={onDeleteActionEvent}
        onSaveAction={(payload) => onSaveActionEvent(payload)}
      />
    </>
  )
}

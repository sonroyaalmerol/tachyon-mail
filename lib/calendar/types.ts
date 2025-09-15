export interface CalendarEvent {
  id: number
  title: string
  date: number
  time: string
  isAllDay: boolean
  description?: string
  color: string
}

export type CalendarViewMode = "month" | "week" | "day"

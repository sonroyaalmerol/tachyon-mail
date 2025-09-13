"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Menu, Plus, Search } from "lucide-react"
import { CalendarViewMode } from "@/lib/calendar/types"
import { eventColors, monthNames, viewModes } from "@/lib/calendar/constants"

export function CalendarHeader({
  currentDate,
  onPrevMonthAction,
  onNextMonthAction,
  onTodayAction,
  onOpenSidebarAction,
  viewMode,
  setViewModeAction,
  selectedEventColor,
  setSelectedEventColorAction,
  eventSearchQuery,
  setEventSearchQueryAction,
  onCreateEventAction,
}: {
  currentDate: Date
  onPrevMonthAction: () => void
  onNextMonthAction: () => void
  onTodayAction: () => void
  onOpenSidebarAction: () => void
  viewMode: CalendarViewMode
  setViewModeAction: (m: CalendarViewMode) => void
  selectedEventColor: string
  setSelectedEventColorAction: (v: string) => void
  eventSearchQuery: string
  setEventSearchQueryAction: (v: string) => void
  onCreateEventAction: () => void
}) {
  return (
    <div className="border-b border-border bg-card flex-shrink-0">
      <div className="h-14 md:h-16 flex items-center justify-between px-3 md:px-6">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-1">
          <Button variant="ghost" size="sm" onClick={onOpenSidebarAction} className="h-8 w-8 p-0 md:hidden flex-shrink-0">
            <Menu className="h-4 w-4" />
          </Button>
          <h1 className="text-base md:text-xl font-semibold text-foreground truncate">
            <span className="hidden sm:inline">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <span className="sm:hidden">
              {monthNames[currentDate.getMonth()].slice(0, 3)} {currentDate.getFullYear()}
            </span>
          </h1>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={onPrevMonthAction} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onNextMonthAction} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onTodayAction} className="text-xs md:text-sm px-2 md:px-3">
            Today
          </Button>
          <Button variant="default" size="sm" onClick={onCreateEventAction} className="text-xs md:text-sm px-2 md:px-3">
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">New Event</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      <div className="px-3 md:px-6 pb-3 md:pb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Select value={viewMode} onValueChange={(v: CalendarViewMode) => setViewModeAction(v)}>
              <SelectTrigger className="w-24 md:w-32 bg-background border-border text-xs md:text-sm flex-shrink-0">
                <CalendarDays className="h-4 w-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {viewModes.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEventColor} onValueChange={setSelectedEventColorAction}>
              <SelectTrigger className="w-28 md:w-36 bg-background border-border text-xs md:text-sm flex-shrink-0">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Colors</SelectItem>
                {eventColors.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color.class.split(" ")[0]}`} />
                      {color.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={eventSearchQuery}
                onChange={(e) => setEventSearchQueryAction(e.target.value)}
                className="pl-10 bg-background border-border text-sm w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

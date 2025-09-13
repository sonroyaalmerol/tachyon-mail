"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Plus, Trash2, X, Clock } from "lucide-react"
import { CalendarEvent } from "@/lib/calendar/types"
import { eventColors, monthNames } from "@/lib/calendar/constants"
import { useEffect, useState } from "react"

export function EventDialog({
  open,
  onOpenChangeAction,
  selectedDay,
  currentDate,
  selectedEvent,
  onDeleteAction,
  onSaveAction,
}: {
  open: boolean
  onOpenChangeAction: (v: boolean) => void
  selectedDay: number | null
  currentDate: Date
  selectedEvent: CalendarEvent | null
  onDeleteAction: () => void
  onSaveAction: (event: Omit<CalendarEvent, "id" | "date"> & { date: number; id?: number }) => void
}) {
  const [form, setForm] = useState<{ title: string; time: string; description: string; color: string }>({
    title: "",
    time: "",
    description: "",
    color: "primary",
  })

  useEffect(() => {
    if (selectedEvent) {
      setForm({
        title: selectedEvent.title,
        time: selectedEvent.time,
        description: selectedEvent.description || "",
        color: selectedEvent.color,
      })
    } else {
      setForm({ title: "", time: "", description: "", color: "primary" })
    }
  }, [selectedEvent, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] bg-popover border-border mx-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border">
          <DialogTitle className="text-lg font-semibold text-popover-foreground flex items-center gap-2">
            {selectedEvent ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {selectedEvent ? "Edit Event" : "New Event"}
          </DialogTitle>
          <Button variant="ghost" size="sm" onClick={() => onOpenChangeAction(false)} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Event Title</Label>
            <Input
              id="event-title"
              placeholder="Enter event title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="bg-input border-border text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                value={
                  selectedDay ? `${monthNames[currentDate.getMonth()]} ${selectedDay}, ${currentDate.getFullYear()}` : ""
                }
                disabled
                className="bg-muted border-border text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-time">Time</Label>
              <Input
                id="event-time"
                type="time"
                value={form.time}
                onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                className="bg-input border-border text-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-color">Color</Label>
            <Select value={form.color} onValueChange={(value) => setForm((p) => ({ ...p, color: value }))}>
              <SelectTrigger className="bg-input border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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

          <div className="space-y-2">
            <Label htmlFor="event-description">Description (Optional)</Label>
            <Textarea
              id="event-description"
              placeholder="Add event description..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="min-h-[80px] bg-input border-border text-foreground resize-none"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-border">
          <div>
            {selectedEvent && (
              <Button variant="destructive" onClick={onDeleteAction} size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChangeAction(false)} className="border-border bg-transparent">
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedDay &&
                onSaveAction({
                  id: selectedEvent?.id,
                  title: form.title,
                  time: form.time,
                  description: form.description,
                  color: form.color,
                  date: selectedDay,
                })
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={!form.title || !selectedDay}
            >
              <Clock className="h-4 w-4 mr-2" />
              {selectedEvent ? "Update" : "Create"} Event
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

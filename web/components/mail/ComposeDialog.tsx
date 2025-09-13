"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Send, X } from "lucide-react"
import { useState } from "react"

export function ComposeDialog({
  open,
  onOpenChangeAction,
  onSendAction,
}: {
  open: boolean
  onOpenChangeAction: (v: boolean) => void
  onSendAction: (data: { to: string; subject: string; message: string }) => void
}) {
  const [form, setForm] = useState({ to: "", subject: "", message: "" })

  const close = () => {
    onOpenChangeAction(false)
    setForm({ to: "", subject: "", message: "" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] bg-popover border-border mx-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border">
          <DialogTitle className="text-lg font-semibold text-popover-foreground">New Message</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="sm" onClick={close} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              placeholder="recipient@example.com"
              value={form.to}
              onChange={(e) => setForm((p) => ({ ...p, to: e.target.value }))}
              className="bg-input border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Enter subject"
              value={form.subject}
              onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              className="bg-input border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Compose your message..."
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              className="min-h-[200px] bg-input border-border text-foreground resize-none"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-border">
          <Button variant="outline" onClick={close} className="border-border bg-transparent">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSendAction(form)
              close()
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={!form.to || !form.subject}
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

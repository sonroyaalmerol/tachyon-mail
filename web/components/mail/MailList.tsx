"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Star } from "lucide-react"
import { EmailItem } from "@/lib/mail/types"

export function MailList({
  emails,
  onSelectEmailAction,
}: {
  emails: EmailItem[]
  onSelectEmailAction: (id: number) => void
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="h-full">
          {emails.map((email) => (
            <div
              key={email.id}
              className={`border-b border-border p-3 md:p-4 hover:bg-muted/50 cursor-pointer transition-colors ${email.unread ? "bg-card" : "bg-background"
                }`}
              onClick={() => onSelectEmailAction(email.id)}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                  <AvatarFallback className="text-xs md:text-sm">
                    {email.sender
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p
                      className={`text-sm truncate ${email.unread ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                        }`}
                    >
                      {email.sender}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{email.time}</span>
                      {email.starred && <Star className="h-4 w-4 text-secondary fill-current flex-shrink-0" />}
                    </div>
                  </div>
                  <p
                    className={`text-sm mb-1 truncate ${email.unread ? "font-medium text-foreground" : "text-muted-foreground"
                      }`}
                  >
                    {email.subject}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">{email.preview}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

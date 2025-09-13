"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Archive, ArrowLeft, Forward, MoreHorizontal, Reply, Star, Trash2 } from "lucide-react"
import { EmailItem } from "@/lib/mail/types"

export function MailDetail({
  email,
  onBackAction,
}: {
  email: EmailItem
  onBackAction: () => void
}) {
  return (
    <>
      <div className="h-14 md:h-16 border-b border-border flex items-center px-3 md:px-6 bg-card flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBackAction} className="flex-shrink-0 h-8 w-8 p-0 md:px-3">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden md:inline ml-2">Back</span>
          </Button>
          <h1 className="text-sm md:text-lg font-semibold text-foreground truncate">{email.subject}</h1>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-3 md:p-6">
          <div className="bg-card rounded-lg border border-border p-4 md:p-6 mb-4 md:mb-6">
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                  <AvatarFallback>
                    {email.sender
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base md:text-lg font-semibold text-card-foreground truncate">{email.sender}</h2>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">{email.senderEmail}</p>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">
                    {email.date} at {email.time}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {email.starred && <Star className="h-4 w-4 md:h-5 md:w-5 text-secondary fill-current" />}
                {email.unread && (
                  <Badge variant="secondary" className="text-xs">
                    Unread
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-border">
              <Button variant="outline" size="sm" className="text-xs md:text-sm bg-transparent">
                <Reply className="h-4 w-4 mr-1 md:mr-2" />
                Reply
              </Button>
              <Button variant="outline" size="sm" className="text-xs md:text-sm bg-transparent">
                <Forward className="h-4 w-4 mr-1 md:mr-2" />
                Forward
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-4 md:p-6">
            <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{email.content}</div>
          </div>
        </div>
      </div>
    </>
  )
}

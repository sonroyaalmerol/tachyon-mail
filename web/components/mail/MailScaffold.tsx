"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Menu, Search } from "lucide-react"
import { MailList } from "@/components/mail/MailList"
import { EmailItem } from "@/lib/mail/types"
import { useState } from "react"
import { MailDetail } from "./MailDetail"
import { useShell } from "../common/ShellContext"

export function MailScaffold({
  title,
  emails,
  showSearch = true,
}: {
  title: string
  emails: EmailItem[]
  showSearch?: boolean
}) {
  const { openSidebar: onOpenSidebarAction } = useShell()

  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null)
  const selectedEmail = emails.find((e) => e.id === selectedEmailId) as EmailItem | undefined

  return (
    <>
      <div className="h-14 md:h-16 border-b border-border flex items-center px-3 md:px-6 bg-card gap-2 md:gap-4 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSidebarAction}
          className="h-8 w-8 p-0 md:hidden flex-shrink-0"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <h1 className="text-sm md:text-lg font-semibold text-foreground">{title}</h1>
        {showSearch && (
          <div className="flex-1 min-w-0 ml-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={`Search ${title.toLowerCase()}...`} className="pl-10 bg-background border-border text-sm w-full" />
            </div>
          </div>
        )}
      </div>

      {selectedEmail && selectedEmailId ? (
        <MailDetail
          email={selectedEmail}
          onBackAction={() => setSelectedEmailId(null)}
        />
      ) : (
        <MailList
          emails={emails}
          onSelectEmailAction={setSelectedEmailId}
        />
      )}
    </>
  )
}

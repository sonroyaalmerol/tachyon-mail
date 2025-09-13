"use client"

import { ReactNode, useCallback, useState } from "react"
import { Sidebar } from "@/components/common/Sidebar"
import { ComposeDialog } from "@/components/mail/ComposeDialog"
import { useDarkMode } from "@/hooks/useDarkMode"
import { useRouter } from "next/navigation"
import { ShellProvider } from "./ShellContext"

export type View = "calendar" | "inbox" | "starred" | "sent" | "drafts" | "archive" | "trash"

export function AppShell({
  view,
  children,
}: {
  view: View
  children: ReactNode
}) {
  const { isDark, toggle } = useDarkMode(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const router = useRouter()

  const openSidebar = () => setIsMobileSidebarOpen(true)

  const handleNavigate = useCallback((view: View) => {
    const map: Record<string, string> = {
      inbox: "/mail/inbox",
      starred: "/mail/starred",
      sent: "/mail/sent",
      drafts: "/mail/drafts",
      archive: "/mail/archive",
      trash: "/mail/trash",
      calendar: "/calendar",
    }
    router.push(map[view] ?? "/mail/inbox")
  }, [router])

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        activeView={view}
        onNavigateAction={handleNavigate}
        onComposeAction={() => setComposeOpen(true)}
        isDark={isDark}
        onToggleDarkAction={toggle}
        isMobileOpen={isMobileSidebarOpen}
        setMobileOpenAction={setIsMobileSidebarOpen}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <ShellProvider value={{ openSidebar }}>{children}</ShellProvider>
      </div>

      <ComposeDialog
        open={composeOpen}
        onOpenChangeAction={setComposeOpen}
        onSendAction={(data) => {
          console.log("Sending email:", data)
        }}
      />
    </div>
  )
}

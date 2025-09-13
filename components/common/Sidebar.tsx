"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Mail, Plus, Sun, Moon, Settings, Calendar, Inbox, Star, Send, FileText, Archive, Trash2, X } from "lucide-react"
import { useMemo } from "react"
import { View } from "@/components/common/AppShell"

interface SidebarItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  active?: boolean
  view: View
}

export function Sidebar({
  activeView,
  onNavigateAction,
  onComposeAction,
  isDark,
  onToggleDarkAction,
  isMobileOpen,
  setMobileOpenAction,
}: {
  activeView: View
  onNavigateAction: (v: View) => void
  onComposeAction: () => void
  isDark: boolean
  onToggleDarkAction: () => void
  isMobileOpen: boolean
  setMobileOpenAction: (v: boolean) => void
}) {
  const items: SidebarItem[] = useMemo(
    () => [
      { icon: Inbox, label: "Inbox", count: 12, active: activeView === "inbox", view: "inbox" },
      { icon: Star, label: "Starred", count: 3, active: activeView === "starred", view: "starred" },
      { icon: Send, label: "Sent", active: activeView === "sent", view: "sent" },
      { icon: FileText, label: "Drafts", count: 2, active: activeView === "drafts", view: "drafts" },
      { icon: Archive, label: "Archive", active: activeView === "archive", view: "archive" },
      { icon: Trash2, label: "Trash", active: activeView === "trash", view: "trash" },
      { icon: Calendar, label: "Calendar", active: activeView === "calendar", view: "calendar" },
    ],
    [activeView]
  )

  return (
    <>
      {isMobileOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpenAction(false)} />}
      <div
        className={`fixed md:relative inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transform transition-transform duration-200 ease-in-out md:transform-none ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
      >
        <div className="p-3 md:p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <span className="font-semibold text-sm md:text-base text-sidebar-foreground">Webmail</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={onToggleDarkAction} className="h-8 w-8 p-0">
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMobileOpenAction(false)} className="h-8 w-8 p-0 md:hidden">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={onComposeAction}>
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>

        <nav className="flex-1 p-2">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                onNavigateAction(item.view)
                setMobileOpenAction(false)
              }}
              className={`w-full flex items-center justify-between p-3 rounded-lg text-left hover:bg-sidebar-accent transition-colors min-h-[44px] ${item.active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground"
                }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {item.count ? (
                <Badge variant="secondary" className="text-xs">
                  {item.count}
                </Badge>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="p-3 md:p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-medium text-sidebar-foreground truncate">john.doe@company.com</p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

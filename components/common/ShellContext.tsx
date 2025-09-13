"use client"

import { createContext, useContext } from "react"

type ShellContextValue = {
  openSidebar: () => void
}

const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell() {
  const ctx = useContext(ShellContext)
  if (!ctx) {
    throw new Error("useShell must be used within AppShell")
  }
  return ctx
}

export function ShellProvider({
  value,
  children,
}: {
  value: ShellContextValue
  children: React.ReactNode
}) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

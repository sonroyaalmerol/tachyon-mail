import { AppShell } from "@/components/common/AppShell"
import { CalendarSection } from "@/components/sections/CalendarSection"

export default function Page() {
  return (
    <AppShell view="calendar">
      <CalendarSection />
    </AppShell>
  )
}

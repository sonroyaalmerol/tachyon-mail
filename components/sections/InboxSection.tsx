"use client"

import { emails as seedEmails } from "@/lib/mail/data"
import { MailScaffold } from "@/components/mail/MailScaffold"
import { AppShell } from "@/components/common/AppShell"

export function InboxSection({
  selectedEmailId = "",
}: {
  selectedEmailId?: string
}) {
  return (
    <AppShell view="inbox">
      <MailScaffold
        title="Inbox"
        category="inbox"
        emails={seedEmails}
        showSearch={true}
        selectedEmailId={selectedEmailId}
      />
    </AppShell>
  )
}

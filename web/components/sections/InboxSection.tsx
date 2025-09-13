"use client"

import { emails as seedEmails } from "@/lib/mail/data"
import { MailScaffold } from "@/components/mail/MailScaffold"
import { AppShell } from "@/components/common/AppShell"

export function InboxSection() {
  return (
    <AppShell view="inbox">
      <MailScaffold
        title="Inbox"
        emails={seedEmails}
        showSearch={true}
      />
    </AppShell>
  )
}

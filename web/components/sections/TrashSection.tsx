"use client"

import { MailScaffold } from "@/components/mail/MailScaffold"
import { emails as seedEmails } from "@/lib/mail/data"
import { AppShell } from "@/components/common/AppShell"

export function TrashSection() {
  return (
    <AppShell view="trash">
      <MailScaffold
        title="Trash"
        emails={seedEmails}
        showSearch={true}
      />
    </AppShell>
  )
}

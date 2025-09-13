"use client"

import { MailScaffold } from "@/components/mail/MailScaffold"
import { emails as seedEmails } from "@/lib/mail/data"
import { AppShell } from "@/components/common/AppShell"

export function SentSection() {
  return (
    <AppShell view="sent">
      <MailScaffold
        title="Sent"
        emails={seedEmails}
        showSearch={true}
      />
    </AppShell>
  )
}

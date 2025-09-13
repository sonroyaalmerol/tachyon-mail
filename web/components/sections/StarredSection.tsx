"use client"

import { MailScaffold } from "@/components/mail/MailScaffold"
import { emails as seedEmails } from "@/lib/mail/data"
import { AppShell } from "@/components/common/AppShell"

export function StarredSection() {
  return (
    <AppShell view="starred">
      <MailScaffold
        title="Starred"
        emails={seedEmails}
        showSearch={true}
      />
    </AppShell>
  )
}

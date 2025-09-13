"use client"

import { MailScaffold } from "@/components/mail/MailScaffold"
import { emails as seedEmails } from "@/lib/mail/data"
import { AppShell } from "@/components/common/AppShell"

export function DraftsSection() {
  return (
    <AppShell view="drafts">
      <MailScaffold
        title="Drafts"
        emails={seedEmails}
        showSearch={true}
      />
    </AppShell>
  )
}

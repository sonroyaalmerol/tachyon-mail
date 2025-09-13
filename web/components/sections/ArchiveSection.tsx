"use client"

import { MailScaffold } from "@/components/mail/MailScaffold"
import { emails as seedEmails } from "@/lib/mail/data"
import { AppShell } from "@/components/common/AppShell"

export function ArchiveSection() {
  return (
    <AppShell view="archive">
      <MailScaffold
        title="Archive"
        emails={seedEmails}
        showSearch={true}
      />
    </AppShell>
  )
}

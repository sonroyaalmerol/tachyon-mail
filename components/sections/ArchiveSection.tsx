"use client"

import { MailScaffold } from "@/components/mail/MailScaffold"
import { emails as seedEmails } from "@/lib/mail/data"
import { AppShell } from "@/components/common/AppShell"

export function ArchiveSection({
  selectedEmailId = "",
}: {
  selectedEmailId?: string
}) {
  return (
    <AppShell view="archive">
      <MailScaffold
        title="Archive"
        category="archive"
        emails={seedEmails}
        showSearch={true}
        selectedEmailId={selectedEmailId}
      />
    </AppShell>
  )
}

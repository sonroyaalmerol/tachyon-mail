"use client"

import { MailScaffold } from "@/components/mail/MailScaffold"
import { emails as seedEmails } from "@/lib/mail/data"
import { AppShell } from "@/components/common/AppShell"

export function StarredSection({
  selectedEmailId = "",
}: {
  selectedEmailId?: string
}) {
  return (
    <AppShell view="starred">
      <MailScaffold
        title="Starred"
        category="starred"
        emails={seedEmails}
        showSearch={true}
        selectedEmailId={selectedEmailId}
      />
    </AppShell>
  )
}

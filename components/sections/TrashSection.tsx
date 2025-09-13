"use client"

import { MailScaffold } from "@/components/mail/MailScaffold"
import { emails as seedEmails } from "@/lib/mail/data"
import { AppShell } from "@/components/common/AppShell"

export function TrashSection({
  selectedEmailId = "",
}: {
  selectedEmailId?: string
}) {
  return (
    <AppShell view="trash">
      <MailScaffold
        title="Trash"
        category="trash"
        emails={seedEmails}
        showSearch={true}
        selectedEmailId={selectedEmailId}
      />
    </AppShell>
  )
}

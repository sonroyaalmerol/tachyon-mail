"use client"

import { MailScaffold } from "@/components/mail/MailScaffold"
import { emails as seedEmails } from "@/lib/mail/data"
import { AppShell } from "@/components/common/AppShell"

export function DraftsSection({
  selectedEmailId = "",
}: {
  selectedEmailId?: string
}) {
  return (
    <AppShell view="drafts">
      <MailScaffold
        title="Drafts"
        category="drafts"
        emails={seedEmails}
        showSearch={true}
        selectedEmailId={selectedEmailId}
      />
    </AppShell>
  )
}

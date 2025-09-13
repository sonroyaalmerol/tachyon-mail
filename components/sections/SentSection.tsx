"use client"

import { MailScaffold } from "@/components/mail/MailScaffold"
import { emails as seedEmails } from "@/lib/mail/data"
import { AppShell } from "@/components/common/AppShell"

export function SentSection({
  selectedEmailId = "",
}: {
  selectedEmailId?: string
}) {
  return (
    <AppShell view="sent">
      <MailScaffold
        title="Sent"
        category="sent"
        emails={seedEmails}
        showSearch={true}
        selectedEmailId={selectedEmailId}
      />
    </AppShell>
  )
}

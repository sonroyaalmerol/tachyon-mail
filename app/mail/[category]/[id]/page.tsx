import { View } from "@/components/common/AppShell"
import { ArchiveSection } from "@/components/sections/ArchiveSection"
import { DraftsSection } from "@/components/sections/DraftsSection"
import { InboxSection } from "@/components/sections/InboxSection"
import { SentSection } from "@/components/sections/SentSection"
import { StarredSection } from "@/components/sections/StarredSection"
import { TrashSection } from "@/components/sections/TrashSection"
import { use } from "react"

export default function Page({
  params
}: {
  params: Promise<{ category: View, id: string }>
}) {
  const { category, id } = use(params)

  switch (category) {
    case "inbox":
      return <InboxSection selectedEmailId={id} />
    case "starred":
      return <StarredSection selectedEmailId={id} />
    case "sent":
      return <SentSection selectedEmailId={id} />
    case "drafts":
      return <DraftsSection selectedEmailId={id} />
    case "archive":
      return <ArchiveSection selectedEmailId={id} />
    case "trash":
      return <TrashSection selectedEmailId={id} />
  }
}

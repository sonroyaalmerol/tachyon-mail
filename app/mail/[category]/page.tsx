import { HydrateClient } from "@/trpc/server"
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
  params: Promise<{ category: View }>
}) {
  const { category } = use(params)

  const Section = () => {
    switch (category) {
      case "inbox":
        return <InboxSection />
      case "starred":
        return <StarredSection />
      case "sent":
        return <SentSection />
      case "drafts":
        return <DraftsSection />
      case "archive":
        return <ArchiveSection />
      case "trash":
        return <TrashSection />
    }
  }

  return (
    <HydrateClient>
      <Section />
    </HydrateClient>
  )
}

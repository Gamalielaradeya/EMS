import { ScrollText } from "lucide-react"

import { PlaceholderPage } from "@/components/layout/PlaceholderPage"

export function EventsLogsPage() {
  return (
    <PlaceholderPage
      description="Review anomaly events, notification delivery records, and system logs."
      icon={ScrollText}
      sectionDescription="Event tabs and filterable records arrive with alert and Telegram integration."
      sectionTitle="Operational evidence workspace"
      title="Events & Logs"
    />
  )
}

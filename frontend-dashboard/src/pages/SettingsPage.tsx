import { Settings } from "lucide-react"

import { PlaceholderPage } from "@/components/layout/PlaceholderPage"

export function SettingsPage() {
  return (
    <PlaceholderPage
      description="Review gateway, thermal threshold, notification, and application configuration."
      icon={Settings}
      sectionDescription="Settings forms stay unavailable until protected backend write endpoints are implemented."
      sectionTitle="Configuration workspace"
      title="Settings"
    />
  )
}

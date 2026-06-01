import { Thermometer } from "lucide-react"

import { PlaceholderPage } from "@/components/layout/PlaceholderPage"

export function SensorsReadingsPage() {
  return (
    <PlaceholderPage
      description="Inspect sensor metadata, latest values, and bounded historical readings."
      icon={Thermometer}
      sectionDescription="Sensor cards, history filters, charts, and readings table arrive in the realtime dashboard milestone."
      sectionTitle="Sensor acquisition workspace"
      title="Sensors & Readings"
    />
  )
}

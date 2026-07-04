import type { LucideIcon } from "lucide-react"

import { EmptyState } from "@/components/states/EmptyState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/PageHeader"

interface PlaceholderPageProps {
  title: string
  description: string
  sectionTitle: string
  sectionDescription: string
  icon: LucideIcon
}

export function PlaceholderPage({
  title,
  description,
  sectionTitle,
  sectionDescription,
  icon,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader description={description} title={title} />
      <Card>
        <CardHeader>
          <CardTitle>{sectionTitle}</CardTitle>
          <CardDescription>Foundation route is ready. Feature workflow belongs to a later milestone.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState description={sectionDescription} icon={icon} title="Feature not active yet" />
        </CardContent>
      </Card>
    </div>
  )
}

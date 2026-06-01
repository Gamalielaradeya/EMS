import { BarChart3 } from "lucide-react"

import { EmptyState } from "@/components/states/EmptyState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ChartPlaceholderProps {
  title: string
  description: string
}

export function ChartPlaceholder({ title, description }: ChartPlaceholderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyState
          description="Chart will populate from bounded backend history queries in the readings dashboard milestone."
          icon={BarChart3}
          title="Waiting for sensor history"
        />
      </CardContent>
    </Card>
  )
}

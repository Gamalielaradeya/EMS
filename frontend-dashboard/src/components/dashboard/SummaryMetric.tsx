import type { LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SummaryMetricProps {
  icon: LucideIcon
  label: string
  value: string
  detail: string
  tone?: "default" | "accent"
}

export function SummaryMetric({ icon: Icon, label, value, detail, tone = "default" }: SummaryMetricProps) {
  return (
    <Card className={tone === "accent" ? "bg-accent" : undefined}>
      <CardHeader className="flex-row items-center justify-between gap-3 pb-0">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-4">
        <p className="font-display text-3xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

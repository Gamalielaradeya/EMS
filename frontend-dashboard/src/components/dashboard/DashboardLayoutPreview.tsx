import { MapPinned } from "lucide-react"
import { Link } from "react-router-dom"

import { LayoutCanvas } from "@/components/layout-map/LayoutCanvas"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useActiveLayout } from "@/hooks/useActiveLayout"

export function DashboardLayoutPreview({ eventRevision }: { eventRevision: number }) {
  const activeLayout = useActiveLayout(eventRevision)
  if (!activeLayout) return null

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Testbed placement</CardTitle>
          <CardDescription>Read-only preview of active sensor layout.</CardDescription>
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link to="/layout">
            <MapPinned aria-hidden="true" className="size-4" />
            Open layout
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <LayoutCanvas activeLayout={activeLayout} compact disabled />
      </CardContent>
    </Card>
  )
}

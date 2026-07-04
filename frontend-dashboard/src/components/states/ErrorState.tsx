import { AlertTriangle, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  message: string
  onRetry: () => void
  title?: string
}

export function ErrorState({ message, onRetry, title = "Dashboard API unavailable" }: ErrorStateProps) {
  return (
    <Alert className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </div>
      </div>
      <Button className="shrink-0" onClick={onRetry} size="sm" variant="secondary">
        <RefreshCw aria-hidden="true" className="size-4" />
        Retry
      </Button>
    </Alert>
  )
}

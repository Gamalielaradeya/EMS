import { Component, type ErrorInfo, type ReactNode } from "react"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console for dev visibility; replace with an error-reporting
    // service if available.
    console.error("[EMS ErrorBoundary]", error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle aria-hidden="true" className="size-7" />
          </div>
          <div className="max-w-sm space-y-2">
            <p className="font-display text-xl font-bold">Something went wrong</p>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred in the dashboard. Refresh the page to recover.
            </p>
            <p className="font-mono text-xs text-muted-foreground/70">
              {this.state.error.message}
            </p>
          </div>
          <Button onClick={() => window.location.reload()} size="sm" variant="secondary">
            <RefreshCw aria-hidden="true" className="size-4" />
            Reload page
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

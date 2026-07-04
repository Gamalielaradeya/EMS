import { useEffect, useState } from "react"

import { connectSSE, type SSEConnectionStatus, type SSEEventType } from "@/lib/sse"

export function useSSE(onEvent?: (eventType: SSEEventType) => void) {
  const [status, setStatus] = useState<SSEConnectionStatus>("connecting")

  useEffect(() => connectSSE({ onStatusChange: setStatus, onEvent }), [onEvent])

  return status
}

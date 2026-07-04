import { useEffect, useState } from "react"

import { api } from "@/lib/api"
import type { ActiveLayout } from "@/types/api"

export function useActiveLayout(eventRevision = 0) {
  const [layout, setLayout] = useState<ActiveLayout | null>(null)

  useEffect(() => {
    let active = true
    void api
      .getLayout()
      .then((data) => {
        if (active) setLayout(data)
      })
      .catch(() => {
        if (active) setLayout(null)
      })
    return () => {
      active = false
    }
  }, [eventRevision])

  return layout
}

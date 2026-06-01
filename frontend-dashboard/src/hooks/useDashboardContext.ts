import { useOutletContext } from "react-router-dom"

import { useDashboardSummary } from "@/hooks/useDashboardSummary"

export function useDashboardContext() {
  return useOutletContext<ReturnType<typeof useDashboardSummary>>()
}

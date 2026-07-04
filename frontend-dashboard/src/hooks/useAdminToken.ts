import { useCallback, useEffect, useState } from "react"

import {
  clearRuntimeAdminToken,
  getRuntimeAdminToken,
  hasRuntimeAdminToken,
  setRuntimeAdminToken,
} from "@/lib/adminToken"

/** Dispatched on window whenever the runtime admin token changes, so all
 *  mounted components that call useAdminToken() re-render simultaneously. */
const ADMIN_TOKEN_EVENT = "ems-admin-token-changed"

export function useAdminToken() {
  const [hasToken, setHasToken] = useState(() =>
    Boolean(import.meta.env.VITE_ADMIN_TOKEN?.trim()) || hasRuntimeAdminToken(),
  )

  // Listen for cross-component token changes
  useEffect(() => {
    const handler = () => {
      setHasToken(
        Boolean(import.meta.env.VITE_ADMIN_TOKEN?.trim()) || hasRuntimeAdminToken(),
      )
    }
    window.addEventListener(ADMIN_TOKEN_EVENT, handler)
    return () => window.removeEventListener(ADMIN_TOKEN_EVENT, handler)
  }, [])

  const saveToken = useCallback((token: string) => {
    setRuntimeAdminToken(token)
    setHasToken(true)
    window.dispatchEvent(new Event(ADMIN_TOKEN_EVENT))
  }, [])

  const removeToken = useCallback(() => {
    clearRuntimeAdminToken()
    setHasToken(Boolean(import.meta.env.VITE_ADMIN_TOKEN?.trim()))
    window.dispatchEvent(new Event(ADMIN_TOKEN_EVENT))
  }, [])

  /** Non-reactive snapshot — use only in callbacks, not in render logic. */
  const getToken = useCallback((): string | null => {
    return import.meta.env.VITE_ADMIN_TOKEN?.trim() || getRuntimeAdminToken()
  }, [])

  return { hasToken, saveToken, removeToken, getToken }
}

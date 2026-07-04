/**
 * Runtime admin token — stored in sessionStorage so it survives page refresh
 * within the same browser session but is cleared when the tab is closed.
 *
 * This is intentionally NOT localStorage so the token doesn't persist
 * indefinitely on a shared machine.
 */

const STORAGE_KEY = "ems_admin_token"

export function getRuntimeAdminToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || null
  } catch {
    return null
  }
}

export function setRuntimeAdminToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token.trim())
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}

export function clearRuntimeAdminToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function hasRuntimeAdminToken(): boolean {
  return Boolean(getRuntimeAdminToken())
}

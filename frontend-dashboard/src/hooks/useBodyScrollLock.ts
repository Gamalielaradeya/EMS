import { useEffect } from "react"

/** Locks document scroll while a modal/dialog is open. Restores previous overflow on close. */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousBodyPaddingRight = body.style.paddingRight
    const scrollbarGap = window.innerWidth - html.clientWidth

    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    // Avoid layout shift when the page scrollbar disappears.
    if (scrollbarGap > 0) {
      body.style.paddingRight = `${scrollbarGap}px`
    }

    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.paddingRight = previousBodyPaddingRight
    }
  }, [locked])
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Awaiting data"
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value))
}

export function formatShortTime(value?: string | null) {
  if (!value) return "--"
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))
}

export function formatMeasurement(value?: number, unit = "") {
  return value === undefined ? "--" : `${value.toFixed(1)}${unit}`
}

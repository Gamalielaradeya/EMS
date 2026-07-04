import { RotateCcw, Search } from "lucide-react"
import { useState, type FormEvent, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { controlClassName } from "@/lib/forms"
import type { ReadingHistoryFilters, ReadingQualityStatus, SensorCode } from "@/types/api"

interface ReadingsFiltersProps {
  filters: ReadingHistoryFilters
  onApply: (filters: ReadingHistoryFilters) => void
}

interface FormValues {
  sensor_code: SensorCode | ""
  quality_status: ReadingQualityStatus | ""
  from: string
  to: string
  limit: number
}

const defaultValues: FormValues = {
  sensor_code: "",
  quality_status: "",
  from: "",
  to: "",
  limit: 100,
}

export function ReadingsFilters({ filters, onApply }: ReadingsFiltersProps) {
  const [values, setValues] = useState<FormValues>(() => ({
    sensor_code: filters.sensor_code || "",
    quality_status: filters.quality_status || "",
    from: toLocalInput(filters.from),
    to: toLocalInput(filters.to),
    limit: filters.limit,
  }))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onApply(toApiFilters(values))
  }

  function reset() {
    setValues(defaultValues)
    onApply(toApiFilters(defaultValues))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>History filters</CardTitle>
        <CardDescription>
          Bound the backend query by sensor, local time range, quality status, and row limit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={submit}>
          <FilterField label="Sensor">
            <select
              className={controlClassName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  sensor_code: event.target.value as SensorCode | "",
                }))
              }
              value={values.sensor_code}
            >
              <option value="">All sensors</option>
              <option value="S1">S1 ambient</option>
              <option value="S2">S2 hotspot</option>
            </select>
          </FilterField>

          <FilterField label="From">
            <input
              className={controlClassName}
              onChange={(event) =>
                setValues((current) => ({ ...current, from: event.target.value }))
              }
              type="datetime-local"
              value={values.from}
            />
          </FilterField>

          <FilterField label="To">
            <input
              className={controlClassName}
              onChange={(event) =>
                setValues((current) => ({ ...current, to: event.target.value }))
              }
              type="datetime-local"
              value={values.to}
            />
          </FilterField>

          <FilterField label="Quality">
            <select
              className={controlClassName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  quality_status: event.target.value as ReadingQualityStatus | "",
                }))
              }
              value={values.quality_status}
            >
              <option value="">All statuses</option>
              <option value="valid">Valid</option>
              <option value="invalid">Invalid</option>
              <option value="timeout">Timeout</option>
              <option value="simulated">Simulated</option>
            </select>
          </FilterField>

          <FilterField label="Limit">
            <select
              className={controlClassName}
              onChange={(event) =>
                setValues((current) => ({ ...current, limit: Number(event.target.value) }))
              }
              value={values.limit}
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
              <option value={500}>500 rows</option>
            </select>
          </FilterField>

          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-5">
            <Button className="h-11 min-h-11" size="sm" type="submit">
              <Search aria-hidden="true" className="size-4" />
              Apply filters
            </Button>
            <Button className="h-11 min-h-11" onClick={reset} size="sm" type="button" variant="secondary">
              <RotateCcw aria-hidden="true" className="size-4" />
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

function toApiFilters(values: FormValues): ReadingHistoryFilters {
  return {
    sensor_code: values.sensor_code || undefined,
    quality_status: values.quality_status || undefined,
    from: toIso(values.from),
    to: toIso(values.to),
    limit: values.limit,
  }
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : undefined
}

function toLocalInput(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

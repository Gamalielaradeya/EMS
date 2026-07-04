import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js"
import { AlertTriangle, LineChart } from "lucide-react"
import { useMemo } from "react"
import { Line } from "react-chartjs-2"

import { EmptyState } from "@/components/states/EmptyState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatShortTime } from "@/lib/format"
import type { SensorReading } from "@/types/api"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

interface ReadingsChartProps {
  description: string
  error?: string | null
  isLoading?: boolean
  measurement: "temperature" | "humidity"
  readings: SensorReading[]
  title: string
}

export function ReadingsChart({
  description,
  error,
  isLoading = false,
  measurement,
  readings,
  title,
}: ReadingsChartProps) {
  const unit = measurement === "temperature" ? "°C" : "%"
  const chartData = useMemo(() => buildChartData(readings, measurement), [measurement, readings])
  const options = useMemo(() => buildOptions(unit), [unit])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex min-h-64 flex-col justify-center rounded-md border border-dashed bg-muted p-5">
            <AlertTriangle aria-hidden="true" className="mb-3 size-5 text-danger" />
            <p className="font-display text-sm font-bold">History unavailable</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{error}</p>
          </div>
        ) : isLoading && readings.length === 0 ? (
          <div className="grid min-h-64 place-items-center rounded-md border border-dashed bg-muted">
            <p className="text-sm font-semibold text-muted-foreground">Loading sensor history...</p>
          </div>
        ) : readings.length === 0 ? (
          <EmptyState
            description="No sensor history matches this bounded query. Insert readings or adjust the filters."
            icon={LineChart}
            title="No chart data"
          />
        ) : (
          <div className="h-72 min-w-0">
            <Line
              aria-label={`${title}. ${description}`}
              data={chartData}
              options={options}
              role="img"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function buildChartData(
  readings: SensorReading[],
  measurement: "temperature" | "humidity",
): ChartData<"line"> {
  const sortedReadings = [...readings].sort(
    (left, right) => new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime(),
  )
  const labels = [...new Set(sortedReadings.map((reading) => reading.recorded_at))]
  const css = getComputedStyle(document.documentElement)
  const s1 = new Map(
    sortedReadings
      .filter((reading) => reading.sensor_code === "S1")
      .map((reading) => [reading.recorded_at, reading[measurement]]),
  )
  const s2 = new Map(
    sortedReadings
      .filter((reading) => reading.sensor_code === "S2")
      .map((reading) => [reading.recorded_at, reading[measurement]]),
  )

  return {
    labels: labels.map(formatShortTime),
    datasets: [
      chartDataset("S1 ambient", css.getPropertyValue("--color-chart-s1").trim(), labels, s1),
      chartDataset("S2 hotspot", css.getPropertyValue("--color-chart-s2").trim(), labels, s2),
    ],
  }
}

function chartDataset(
  label: string,
  color: string,
  labels: string[],
  values: Map<string, number>,
) {
  return {
    label,
    data: labels.map((recordedAt) => values.get(recordedAt) ?? null),
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    pointRadius: labels.length > 40 ? 0 : 2,
    pointHoverRadius: 4,
    spanGaps: true,
    tension: 0.18,
  }
}

function buildOptions(unit: string): ChartOptions<"line"> {
  return {
    maintainAspectRatio: false,
    responsive: true,
    interaction: {
      intersect: false,
      mode: "index",
    },
    plugins: {
      legend: {
        align: "start",
        labels: {
          boxHeight: 8,
          boxWidth: 8,
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y?.toFixed(1) ?? "--"}${unit}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          autoSkip: true,
          maxTicksLimit: 8,
          maxRotation: 0,
        },
      },
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: unit,
        },
      },
    },
  }
}

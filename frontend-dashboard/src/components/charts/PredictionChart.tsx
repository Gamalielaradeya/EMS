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
import { LineChart } from "lucide-react"
import { useMemo } from "react"
import { Line } from "react-chartjs-2"

import { EmptyState } from "@/components/states/EmptyState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatShortTime } from "@/lib/format"
import type { Prediction } from "@/types/api"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

interface PredictionChartProps {
  predictions: Prediction[]
}

export function PredictionChart({ predictions }: PredictionChartProps) {
  const data = useMemo(() => chartData(predictions), [predictions])
  const options = useMemo(() => chartOptions(), [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actual vs predicted S2</CardTitle>
        <CardDescription>
          Bounded prediction history. Actual values appear after backend finds a nearby S2 reading.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {predictions.length === 0 ? (
          <EmptyState
            description="No prediction history exists yet. Run ML inference after a model is ready."
            icon={LineChart}
            title="No prediction chart data"
          />
        ) : (
          <div className="h-72 min-w-0">
            <Line aria-label="Actual versus predicted S2 temperature history" data={data} options={options} role="img" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function chartData(predictions: Prediction[]): ChartData<"line"> {
  const ordered = [...predictions].sort(
    (left, right) => new Date(left.predicted_for).getTime() - new Date(right.predicted_for).getTime(),
  )
  const css = getComputedStyle(document.documentElement)
  return {
    labels: ordered.map((prediction) => formatShortTime(prediction.predicted_for)),
    datasets: [
      {
        label: "Predicted S2",
        data: ordered.map((prediction) => prediction.predicted_temperature),
        borderColor: css.getPropertyValue("--color-chart-s2").trim(),
        backgroundColor: css.getPropertyValue("--color-chart-s2").trim(),
        borderWidth: 2,
        pointRadius: ordered.length > 40 ? 0 : 2,
        tension: 0.18,
      },
      {
        label: "Actual S2",
        data: ordered.map((prediction) => prediction.actual_temperature),
        borderColor: css.getPropertyValue("--color-chart-s1").trim(),
        backgroundColor: css.getPropertyValue("--color-chart-s1").trim(),
        borderDash: [5, 4],
        borderWidth: 2,
        pointRadius: ordered.length > 40 ? 0 : 2,
        spanGaps: false,
        tension: 0.18,
      },
    ],
  }
}

function chartOptions(): ChartOptions<"line"> {
  return {
    maintainAspectRatio: false,
    responsive: true,
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: { align: "start", labels: { boxHeight: 8, boxWidth: 8, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y?.toFixed(2) ?? "--"}°C`,
        },
      },
    },
    scales: {
      x: { ticks: { autoSkip: true, maxRotation: 0, maxTicksLimit: 8 } },
      y: { beginAtZero: false, title: { display: true, text: "°C" } },
    },
  }
}

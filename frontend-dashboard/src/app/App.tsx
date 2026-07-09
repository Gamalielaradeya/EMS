import { Navigate, Route, Routes } from "react-router-dom"
import { lazy, Suspense, type ReactNode } from "react"

import { AppLayout } from "@/components/layout/AppLayout"
import { LoadingState } from "@/components/states/LoadingState"

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })),
)
const EventsLogsPage = lazy(() =>
  import("@/pages/EventsLogsPage").then((module) => ({ default: module.EventsLogsPage })),
)
const LayoutPage = lazy(() =>
  import("@/pages/LayoutPage").then((module) => ({ default: module.LayoutPage })),
)
const PredictionLSTMPage = lazy(() =>
  import("@/pages/PredictionLSTMPage").then((module) => ({ default: module.PredictionLSTMPage })),
)
const SensorsReadingsPage = lazy(() =>
  import("@/pages/SensorsReadingsPage").then((module) => ({ default: module.SensorsReadingsPage })),
)
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((module) => ({ default: module.SettingsPage })),
)

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route element={<PageRoute><DashboardPage /></PageRoute>} index />
        <Route element={<PageRoute><SensorsReadingsPage /></PageRoute>} path="sensors-readings" />
        <Route element={<PageRoute><PredictionLSTMPage /></PageRoute>} path="prediction-lstm" />
        <Route element={<PageRoute><LayoutPage /></PageRoute>} path="layout" />
        <Route element={<PageRoute><EventsLogsPage /></PageRoute>} path="events-logs" />
        <Route element={<PageRoute><SettingsPage /></PageRoute>} path="settings" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  )
}

function PageRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
}

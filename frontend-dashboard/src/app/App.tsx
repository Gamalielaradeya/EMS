import { Navigate, Route, Routes } from "react-router-dom"

import { AppLayout } from "@/components/layout/AppLayout"
import { DashboardPage } from "@/pages/DashboardPage"
import { EventsLogsPage } from "@/pages/EventsLogsPage"
import { LayoutPage } from "@/pages/LayoutPage"
import { PredictionLSTMPage } from "@/pages/PredictionLSTMPage"
import { SensorsReadingsPage } from "@/pages/SensorsReadingsPage"
import { SettingsPage } from "@/pages/SettingsPage"

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route element={<DashboardPage />} index />
        <Route element={<SensorsReadingsPage />} path="sensors-readings" />
        <Route element={<PredictionLSTMPage />} path="prediction-lstm" />
        <Route element={<LayoutPage />} path="layout" />
        <Route element={<EventsLogsPage />} path="events-logs" />
        <Route element={<SettingsPage />} path="settings" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Route>
    </Routes>
  )
}

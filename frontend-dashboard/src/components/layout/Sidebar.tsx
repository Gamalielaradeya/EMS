import {
  Activity,
  BrainCircuit,
  LayoutDashboard,
  Map,
  Menu,
  ScrollText,
  Settings,
  Thermometer,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { NavLink } from "react-router-dom"

import { cn } from "@/lib/utils"

const menuItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, end: true },
  { label: "Sensors & Readings", path: "/sensors-readings", icon: Thermometer },
  { label: "Prediction & LSTM", path: "/prediction-lstm", icon: BrainCircuit },
  { label: "Layout", path: "/layout", icon: Map },
  { label: "Events & Logs", path: "/events-logs", icon: ScrollText },
  { label: "Settings", path: "/settings", icon: Settings },
] as const

export function Sidebar() {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <Brand />
        <nav aria-label="Primary navigation" className="flex flex-1 flex-col gap-1 px-3 py-4">
          {menuItems.map((item) => (
            <SidebarLink key={item.path} {...item} />
          ))}
        </nav>
        <div className="border-t border-sidebar-raised px-5 py-5">
          <div className="flex items-center gap-3 text-sidebar-muted">
            <Activity aria-hidden="true" className="size-4" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em]">Hardware first</p>
              <p className="mt-1 text-xs leading-5">S1 ambient · S2 hotspot</p>
            </div>
          </div>
        </div>
      </aside>

      <details className="group relative bg-sidebar text-sidebar-foreground lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
          <BrandCompact />
          <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold text-sidebar-muted">
            Menu
            <Menu aria-hidden="true" className="size-4" />
          </span>
        </summary>
        <nav aria-label="Primary navigation" className="grid gap-1 border-t border-sidebar-raised px-3 py-3 sm:grid-cols-2">
          {menuItems.map((item) => (
            <SidebarLink compact key={item.path} {...item} />
          ))}
        </nav>
      </details>
    </>
  )
}

function Brand() {
  return (
    <div className="border-b border-sidebar-raised px-5 py-5">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-md bg-sidebar-active text-sidebar-foreground">
          <Activity aria-hidden="true" className="size-5" />
        </div>
        <div>
          <p className="font-display text-sm font-bold tracking-wide">EMS Thermal</p>
          <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-sidebar-muted">
            LSTM monitor
          </p>
        </div>
      </div>
    </div>
  )
}

function BrandCompact() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-md bg-sidebar-active text-sidebar-foreground">
        <Activity aria-hidden="true" className="size-4" />
      </span>
      <span className="font-display text-sm font-bold tracking-wide">EMS Thermal LSTM</span>
    </span>
  )
}

interface SidebarLinkProps {
  label: string
  path: string
  icon: LucideIcon
  end?: boolean
  compact?: boolean
}

function SidebarLink({ label, path, icon: Icon, end, compact = false }: SidebarLinkProps) {
  return (
    <NavLink
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-semibold text-sidebar-muted transition-[background-color,color] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-sidebar-active",
          isActive
            ? "bg-sidebar-active text-sidebar-foreground"
            : "hover:bg-sidebar-raised hover:text-sidebar-foreground",
          compact && "shrink-0",
        )
      }
      end={end}
      to={path}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

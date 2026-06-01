import { Skeleton } from "@/components/ui/skeleton"

export function LoadingState() {
  return (
    <div aria-label="Loading dashboard summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="rounded-lg border bg-card p-5 shadow-card" key={index}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-5 h-9 w-32" />
          <Skeleton className="mt-4 h-3 w-40" />
        </div>
      ))}
    </div>
  )
}

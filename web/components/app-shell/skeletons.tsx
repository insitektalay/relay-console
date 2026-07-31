import { Skeleton } from "@/components/ui/skeleton"

export function ShellLoading() {
  return (
    <div className="mx-auto grid min-h-screen max-w-[1800px] grid-cols-[220px_320px_minmax(0,1fr)] gap-4 px-4 py-4 xl:grid-cols-[228px_340px_minmax(0,1fr)]">
      <Skeleton className="h-[calc(100vh-48px)] rounded-3xl" />
      <Skeleton className="h-[calc(100vh-48px)] rounded-3xl" />
      <Skeleton className="h-[calc(100vh-48px)] rounded-3xl" />
    </div>
  )
}

export function ThreadListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 7 }).map((_, index) => (
        <Skeleton key={index} className="h-24 rounded-3xl" />
      ))}
    </div>
  )
}

export function MessageSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <Skeleton className="h-24 w-[68%] rounded-3xl" />
        </div>
      ))}
    </div>
  )
}

export function ApprovalListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-3xl" />
      ))}
    </div>
  )
}

export function ApprovalDetailSkeleton() {
  return (
    <div className="space-y-6 px-6 py-5">
      <Skeleton className="h-10 w-72 rounded-2xl" />
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-56 rounded-3xl" />
    </div>
  )
}

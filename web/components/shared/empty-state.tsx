import type { ReactNode } from "react"

export function EmptyState({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="mission-surface rounded-3xl border border-dashed px-5 py-10 text-center backdrop-blur-sm">
      <div className="mission-kicker">Standby</div>
      <div className="mt-1 text-base font-medium tracking-[-0.02em]">
        {title}
      </div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
        {description}
      </div>
      {actions ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function EmptyPanel({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState title={title} description={description} actions={actions} />
    </div>
  )
}

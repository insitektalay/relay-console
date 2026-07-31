import type { ReactNode } from "react"

export function CompactNotice({ children }: { children: ReactNode }) {
  return (
    <div className="claw-caption rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] px-3 py-2.5 leading-5 text-[var(--claw-text-muted)]">
      {children}
    </div>
  )
}

export function LabeledField({
  label,
  children,
  className,
  htmlFor,
}: {
  label: string
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  const labelClassName = "claw-kicker tracking-[0.16em] text-zinc-500 uppercase"

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      {htmlFor ? (
        <label className={labelClassName} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <div className={labelClassName}>{label}</div>
      )}
      {children}
    </div>
  )
}

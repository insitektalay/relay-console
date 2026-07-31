export function DepartmentAvatarBadge({ color }: { color?: string | null }) {
  const value = color?.trim()
  if (!value) return null

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -right-0.5 -bottom-0.5 z-20 size-2 rounded-full border border-[var(--claw-bg-page)]"
      style={{ backgroundColor: value }}
    />
  )
}

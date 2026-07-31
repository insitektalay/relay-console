export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="claw-kicker tracking-[0.2em] text-zinc-500 uppercase">
        {label}
      </div>
      <div className="text-sm leading-6 text-zinc-100">{value}</div>
    </div>
  )
}

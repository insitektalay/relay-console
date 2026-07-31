import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "mission-input flex field-sizing-content min-h-16 w-full rounded-[4px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-surface)] px-2.5 py-2 text-sm text-[var(--claw-text-primary)] shadow-none transition-[color,border-color,background-color] outline-none placeholder:text-[var(--claw-text-muted)] focus-visible:border-[var(--claw-accent-blue)] focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

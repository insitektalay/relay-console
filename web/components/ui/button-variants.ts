import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[4px] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-[var(--claw-accent-blue)] focus-visible:ring-0 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-[#4f91e8] bg-[#4f91e8] text-[#071321] hover:bg-[#4f91e8]",
        outline:
          "border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] bg-[var(--claw-bg-surface)] text-[var(--claw-text-muted)] hover:text-[var(--claw-text-primary)] aria-expanded:text-[var(--claw-text-primary)]",
        secondary:
          "border-[color-mix(in_srgb,var(--claw-accent-blue)_36%,transparent)] bg-[color-mix(in_srgb,var(--claw-accent-blue)_12%,var(--claw-bg-surface))] text-[#b9d6f8] hover:bg-[color-mix(in_srgb,var(--claw-accent-blue)_16%,var(--claw-bg-surface))] aria-expanded:text-[#b9d6f8]",
        ghost:
          "text-[var(--claw-text-muted)] hover:bg-[var(--claw-bg-surface)] hover:text-[var(--claw-text-primary)] aria-expanded:bg-[var(--claw-bg-surface)] aria-expanded:text-[var(--claw-text-primary)]",
        destructive:
          "border-destructive/20 bg-destructive/12 text-red-200 hover:bg-destructive/18 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[4px] px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[4px] px-2.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[4px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[4px]",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export { buttonVariants }
export type ButtonVariantProps = VariantProps<typeof buttonVariants>

import type { ReactNode } from "react"

export function DesktopShell({
  header,
  sidebar,
  detailPane,
}: {
  header: ReactNode
  sidebar: ReactNode
  detailPane: ReactNode
  sidebarCollapsed?: boolean
}) {
  return (
    <>
      <div
        className="mission-shell flex h-dvh w-screen items-center justify-center bg-[var(--claw-bg-page)] p-6 text-[var(--claw-text-primary)] lg:hidden"
        role="status"
      >
        <div className="max-w-md rounded-[6px] border border-[color-mix(in_srgb,var(--claw-border)_42%,transparent)] bg-[var(--claw-bg-sidebar)] p-5 shadow-2xl shadow-black/30">
          <div className="text-base font-semibold">Desktop beta</div>
          <div className="mt-2 text-sm leading-6 text-[var(--claw-text-secondary)]">
            Relay Console beta is currently supported on desktop-width browsers.
            Mobile and narrow tablet layouts are not enabled for this beta
            cohort.
          </div>
        </div>
      </div>

      <div className="mission-shell hidden h-screen w-screen bg-[var(--claw-bg-page)] text-[var(--claw-text-primary)] lg:block">
        <div className="relative z-10 h-full">
          {header}
          <div className="grid h-full w-full grid-cols-[462px_minmax(0,1fr)]">
            {sidebar}
            {detailPane}
          </div>
        </div>
      </div>
    </>
  )
}

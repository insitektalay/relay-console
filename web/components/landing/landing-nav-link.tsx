"use client"

import type { MouseEvent, ReactNode } from "react"

type LandingNavLinkProps = {
  children: ReactNode
  className?: string
  href: `#${string}`
  scrollOffset?: number
}

const easeOutBack = (progress: number) => {
  const overshoot = 1.22
  return 1 + (overshoot + 1) * Math.pow(progress - 1, 3) + overshoot * Math.pow(progress - 1, 2)
}

export function LandingNavLink({ children, className, href, scrollOffset = 24 }: LandingNavLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const id = href.slice(1)
    const target = document.getElementById(id)

    if (!target) {
      return
    }

    event.preventDefault()

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const startY = window.scrollY
    const targetY = Math.min(
      target.getBoundingClientRect().top + window.scrollY - scrollOffset,
      document.documentElement.scrollHeight - window.innerHeight,
    )
    const distance = targetY - startY

    window.history.replaceState(null, "", href)

    if (reducedMotion || Math.abs(distance) < 2) {
      window.scrollTo({ top: targetY })
      return
    }

    const duration = Math.min(950, Math.max(540, Math.abs(distance) * 0.45))
    const startedAt = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startedAt
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutBack(progress)

      window.scrollTo({ top: startY + distance * eased })

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        window.scrollTo({ top: targetY })
      }
    }

    requestAnimationFrame(animate)
  }

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  )
}

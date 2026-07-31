"use client"

import { useEffect } from "react"
import { AGENTOPS_BOSS_HOTKEYS } from "./livestream-config"
import type { AgentOpsBossActionId } from "./livestream-types"

export function useAgentOpsHotkeys({
  enabled,
  onAction,
}: {
  enabled: boolean
  onAction: (actionId: AgentOpsBossActionId) => void
}) {
  useEffect(() => {
    if (!enabled) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || shouldIgnoreHotkey(event.target)) return
      const actionId = AGENTOPS_BOSS_HOTKEYS.get(event.key)
      if (!actionId) return
      event.preventDefault()
      onAction(actionId)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled, onAction])
}

function shouldIgnoreHotkey(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true
  }
  return target.isContentEditable
}

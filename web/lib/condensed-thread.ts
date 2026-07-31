import type { Message } from "@clawchat/contracts"
import {
  CONDENSED_MESSAGE_PROVIDER,
  getCondensedMessageMetadata,
  sanitizeCondensedMessageText,
} from "@clawchat/contracts"
import type { RuntimeDispatchUiState } from "@/hooks/use-clawchat-realtime"

export function resolveCondensedMessageText(message: Message) {
  const condensed = getCondensedMessageMetadata(message.metadata)
  if (condensed?.text) {
    const isRuntimeSummary = condensed.provider === CONDENSED_MESSAGE_PROVIDER
    return {
      text: isRuntimeSummary ? condensed.text : "Summary unavailable.",
      source: isRuntimeSummary
        ? ("summary" as const)
        : ("unavailable" as const),
      lineCountHint: condensed.lineCountHint ?? 1,
    }
  }

  return {
    text: "Summary unavailable.",
    source: "unavailable" as const,
    lineCountHint: 2 as const,
  }
}

export function buildCondensedRuntimeStatus(dispatch: RuntimeDispatchUiState) {
  if (dispatch.tasks.length > 0) {
    const activeTask =
      dispatch.tasks.find((task) => task.status === "in_progress") ??
      dispatch.tasks.find((task) => task.status === "pending")
    const completed = dispatch.tasks.filter(
      (task) => task.status === "completed"
    ).length
    const taskText = sanitizeCondensedMessageText(
      activeTask?.content ?? "Task plan complete",
      80
    )
    return `${completed}/${dispatch.tasks.length}: ${taskText}`
  }

  if (dispatch.draftText.trim()) {
    return "Replying"
  }

  if (dispatch.draftThinking.trim()) {
    return "Researching"
  }

  switch (dispatch.status) {
    case "queued":
      return "Queued"
    case "started":
      return "Thinking"
    case "streaming":
      return "Writing"
    default:
      return "Thinking"
  }
}

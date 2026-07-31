import type { Task } from "@clawchat/contracts"

export function defaultTaskTimezone() {
  if (typeof Intl === "undefined") return "UTC"
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

export function defaultTaskScheduleValue() {
  const next = new Date()
  next.setMinutes(next.getMinutes() + 5)
  next.setSeconds(0, 0)
  return toDatetimeLocalValue(next.toISOString(), defaultTaskTimezone())
}

function getTaskDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  ) as Record<string, string>

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function parseDatetimeLocalValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  }
}

function getZonedDateForInput(value: string, timeZone: string) {
  const parsed = parseDatetimeLocalValue(value)
  if (!parsed) return null

  let guess = new Date(
    Date.UTC(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      parsed.hour,
      parsed.minute,
      0,
      0
    )
  )

  for (let index = 0; index < 3; index += 1) {
    const parts = getTaskDateParts(guess, timeZone)
    const desiredMinutes = Math.trunc(
      Date.UTC(
        parsed.year,
        parsed.month - 1,
        parsed.day,
        parsed.hour,
        parsed.minute,
        0,
        0
      ) / 60000
    )
    const actualMinutes = Math.trunc(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        0,
        0
      ) / 60000
    )
    const diffMinutes = desiredMinutes - actualMinutes
    if (!diffMinutes) break
    guess = new Date(guess.getTime() + diffMinutes * 60_000)
  }

  return guess
}

export function toIsoFromDatetimeLocal(value: string, timeZone: string) {
  return (
    getZonedDateForInput(value, timeZone) ?? new Date(value)
  ).toISOString()
}

export function toDatetimeLocalValue(
  value?: string | null,
  timeZone?: string | null
) {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  const parts = getTaskDateParts(parsed, timeZone || defaultTaskTimezone())
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`
}

export function sameInstant(left?: string | null, right?: string | null) {
  if (!left || !right) return false
  const leftTime = new Date(left).getTime()
  const rightTime = new Date(right).getTime()
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return false
  return leftTime === rightTime
}

export function buildTaskPatchOverride(task: Task, intended: Partial<Task>) {
  const override: Partial<Task> = {}

  for (const [key, value] of Object.entries(intended) as Array<
    [keyof Task, Task[keyof Task] | undefined]
  >) {
    if (value === undefined) continue
    if (task[key] !== value) {
      ;(override as Record<string, unknown>)[key] = value
    }
  }

  return override
}

import type { Paginated, Thread } from "@clawchat/contracts"
import type { InfiniteData } from "@tanstack/react-query"

export type ThreadPages = InfiniteData<Paginated<Thread>, number>

export function mapThreadPages(
  current: ThreadPages | undefined,
  mapper: (thread: Thread) => Thread
): ThreadPages | undefined {
  if (!current) return current
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      data: page.data.map(mapper),
    })),
  }
}

export function upsertThreadInPages(
  current: ThreadPages | undefined,
  thread: Thread
): ThreadPages | undefined {
  if (!current) return current
  let inserted = false
  const pages = current.pages.map((page) => {
    const existingIndex = page.data.findIndex((entry) => entry.id === thread.id)
    if (existingIndex === -1) {
      return page
    }
    inserted = true
    return {
      ...page,
      data: page.data.map((entry) =>
        entry.id === thread.id ? { ...entry, ...thread } : entry
      ),
    }
  })

  if (!inserted && pages[0]) {
    pages[0] = {
      ...pages[0],
      data: [thread, ...pages[0].data],
      total: Math.max(pages[0].total, pages[0].data.length + 1),
    }
  }

  return { ...current, pages }
}

import { RelayConsoleAppEntry } from "@/components/clawchat-app-entry"

export default async function AppPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode

  return (
    <main className="min-h-screen">
      <RelayConsoleAppEntry
        initialAuthMode={mode === "register" ? "register" : "login"}
      />
    </main>
  )
}

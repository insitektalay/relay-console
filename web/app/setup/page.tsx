"use client"

import { FormEvent, useState } from "react"

export default function OwnerSetupPage() {
  const [status, setStatus] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("Creating the deployment owner…")
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/v1/deployment/bootstrap/owner", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) })
    if (!response.ok) { const error = await response.json().catch(() => ({})); setStatus(error.message ?? "Owner setup failed."); return }
    event.currentTarget.reset(); setStatus("Owner created. The bootstrap token is now revoked; continue to sign in.")
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e0e10] p-6 text-zinc-100">
      <form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-3xl font-bold">Create deployment owner</h1>
        <p className="text-sm text-zinc-400">This one-time token expires after provisioning and is revoked immediately after use.</p>
        {[["token","One-time bootstrap token","password"],["name","Owner name","text"],["email","Owner email","email"],["password","Password (12+ characters)","password"]].map(([name,label,type]) => <label key={name} className="block text-sm">{label}<input required minLength={name === "password" ? 12 : undefined} name={name} type={type} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2" /></label>)}
        <button className="rounded-lg bg-blue-500 px-5 py-3 font-semibold">Create owner</button>
        {status ? <p role="status" className="text-sm text-zinc-300">{status}</p> : null}
      </form>
    </main>
  )
}

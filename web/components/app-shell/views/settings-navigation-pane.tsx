"use client"
import type { ReactNode } from "react"
import {
  Bot,
  CreditCard,
  Info,
  Play,
  RefreshCcw,
  UserRound,
  Wrench,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type {
  PublicSettingsView,
  RelayConsoleController,
} from "@/components/clawchat-web-app"

export function RelayConsoleSettingsNavigationPane({
  controller,
}: {
  controller: RelayConsoleController
}) {
  const { GroupBrowserButton, setSettingsView, settingsView } = controller

  const sections: Array<{
    id: PublicSettingsView
    label: string
    description: string
    icon: ReactNode
  }> = [
    {
      id: "account",
      label: "Account",
      description: "Your name, email, and profile details.",
      icon: <UserRound className="h-3.5 w-3.5" />,
    },
    {
      id: "billing",
      label: "Subscription",
      description: "Relay subscription, invoices, and payment status.",
      icon: <CreditCard className="h-3.5 w-3.5" />,
    },
    {
      id: "security",
      label: "Security",
      description: "Password, signed-in devices, and sign out.",
      icon: <RefreshCcw className="h-3.5 w-3.5" />,
    },
    {
      id: "privacy",
      label: "Privacy",
      description: "Optional product analytics and crash reports.",
      icon: <Info className="h-3.5 w-3.5" />,
    },
    {
      id: "harnesses",
      label: "Harnesses",
      description: "Hermes and OpenClaw runtime harness setup.",
      icon: <Wrench className="h-3.5 w-3.5" />,
    },
    {
      id: "existing_agents",
      label: "Existing agents",
      description: "Connect agents already configured in your harnesses.",
      icon: <Bot className="h-3.5 w-3.5" />,
    },
    {
      id: "runtime",
      label: "Runtime",
      description: "Live activity detail and action confirmations.",
      icon: <Play className="h-3.5 w-3.5" />,
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[color-mix(in_srgb,var(--claw-border)_34%,transparent)] px-3 py-2.5">
        <div className="claw-title-pane font-semibold tracking-[-0.02em]">
          Settings
        </div>
        <div className="mt-1 text-sm leading-5 text-zinc-400">
          Account, privacy, security, harness, and runtime preferences.
        </div>
      </div>
      <ScrollArea className="mission-scrollbar min-h-0 flex-1">
        <div className="space-y-2 p-2.5">
          {sections.map((entry) => (
            <GroupBrowserButton
              key={entry.id}
              active={settingsView === entry.id}
              icon={entry.icon}
              label={entry.label}
              meta={entry.description}
              onClick={() => setSettingsView(entry.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

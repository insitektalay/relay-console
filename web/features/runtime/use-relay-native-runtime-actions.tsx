"use client"

import { useEffect } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import type { AppSection } from "@/components/app-shell/app-sidebar"
import { Button } from "@/components/ui/button"
import { sdk } from "@/lib/sdk"

export function useRelayNativeRuntimeActions({
  canAccessOperations,
  effectiveSection,
  effectiveWorkspaceId,
  isWorkspaceAdmin,
  queryClient,
  sessionActive,
  setNativeDocumentConsent,
  setSection,
  setSelectedNativeObservationIds,
  setSettingsView,
}: {
  canAccessOperations: boolean
  effectiveSection: AppSection
  effectiveWorkspaceId: string | null
  isWorkspaceAdmin: boolean
  queryClient: QueryClient
  sessionActive: boolean
  setNativeDocumentConsent: (value: boolean) => void
  setSection: (value: AppSection) => void
  setSelectedNativeObservationIds: (value: Set<string>) => void
  setSettingsView: (value: "existing_agents") => void
}) {
  const bridgeDevicesQuery = useQuery({
    queryKey: ["bridge-devices", effectiveWorkspaceId],
    enabled: Boolean(
      sessionActive &&
      effectiveWorkspaceId &&
      isWorkspaceAdmin &&
      (canAccessOperations || effectiveSection === "settings")
    ),
    queryFn: () => sdk.bridge.devices(effectiveWorkspaceId!),
  })

  const runtimeAuthorityQuery = useQuery({
    queryKey: ["runtime-authority", effectiveWorkspaceId],
    enabled: Boolean(
      sessionActive && effectiveWorkspaceId && effectiveSection === "settings"
    ),
    queryFn: () => sdk.workspaces.runtimeAuthority(effectiveWorkspaceId!),
  })

  const runtimeProvisioningTargetsQuery = useQuery({
    queryKey: ["runtime-provisioning-targets", effectiveWorkspaceId],
    enabled: Boolean(
      sessionActive && effectiveWorkspaceId && effectiveSection === "settings"
    ),
    queryFn: () =>
      sdk.workspaces.runtimeProvisioningTargets(effectiveWorkspaceId!),
  })

  const nativeObservationsQuery = useQuery({
    queryKey: ["native-agent-observations", effectiveWorkspaceId],
    enabled: Boolean(sessionActive && effectiveWorkspaceId && isWorkspaceAdmin),
    queryFn: () => sdk.agents.nativeObservations(effectiveWorkspaceId!),
    refetchInterval: 10_000,
  })

  const connectNativeObservationsMutation = useMutation({
    mutationFn: (observationIds: string[]) =>
      sdk.agents.connectNativeObservations(
        effectiveWorkspaceId!,
        observationIds,
        1
      ),
    onSuccess: async (result) => {
      const failures = result.results.filter((row) => row.status === "failed")
      setSelectedNativeObservationIds(new Set())
      setNativeDocumentConsent(false)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["native-agent-observations", effectiveWorkspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["agents", effectiveWorkspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["runtime-authority", effectiveWorkspaceId],
        }),
      ])
      if (failures.length) {
        toast.error(
          `${failures.length} agent${failures.length === 1 ? "" : "s"} could not be connected`
        )
      } else {
        toast.success(
          `${result.results.length} existing agent${result.results.length === 1 ? "" : "s"} connected`
        )
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Connection failed"),
  })

  const retryNativeObservationMutation = useMutation({
    mutationFn: (observationId: string) =>
      sdk.agents.retryNativeObservation(
        effectiveWorkspaceId!,
        observationId,
        1
      ),
    onSuccess: async () => {
      setNativeDocumentConsent(false)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["native-agent-observations", effectiveWorkspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["agents", effectiveWorkspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["runtime-authority", effectiveWorkspaceId],
        }),
      ])
      toast.success("Existing agent connected")
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Connection retry failed"
      ),
  })

  const disconnectNativeObservationMutation = useMutation({
    mutationFn: (observationId: string) =>
      sdk.agents.disconnectNativeObservation(
        effectiveWorkspaceId!,
        observationId
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["native-agent-observations", effectiveWorkspaceId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["runtime-authority", effectiveWorkspaceId],
        }),
      ])
      toast.success("Agent disconnected. Its native files were preserved.")
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Disconnection failed"
      ),
  })

  const dismissNativeObservationMutation = useMutation({
    mutationFn: (observationId: string) =>
      sdk.agents.dismissNativeObservation(effectiveWorkspaceId!, observationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["native-agent-observations", effectiveWorkspaceId],
      })
      toast.success("Candidate hidden. Its native identity was not suppressed.")
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Candidate could not be hidden"
      ),
  })

  const scanRuntimeHostMutation = useMutation({
    mutationFn: (runtimeHostId: string) =>
      sdk.workspaces.scanRuntimeHost(effectiveWorkspaceId!, runtimeHostId),
    onSuccess: () => {
      toast.success("Fresh agent scan requested")
      window.setTimeout(() => {
        void nativeObservationsQuery.refetch()
        void runtimeAuthorityQuery.refetch()
      }, 1500)
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Scan failed"),
  })

  const selectRuntimeProvisioningTargetMutation = useMutation({
    mutationFn: (input: {
      runtimeType: "hermes" | "openclaw"
      runtimeHostId: string
    }) =>
      sdk.workspaces.selectRuntimeProvisioningTarget(
        effectiveWorkspaceId!,
        input.runtimeType,
        input.runtimeHostId
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["runtime-provisioning-targets", effectiveWorkspaceId],
      })
      toast.success("Default creation host updated")
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Host selection failed"
      ),
  })

  useEffect(() => {
    if (!effectiveWorkspaceId || !isWorkspaceAdmin) {
      return
    }
    const candidates = (nativeObservationsQuery.data ?? []).filter(
      (observation) =>
        observation.origin === "customer_existing" &&
        !observation.isDismissed &&
        ["discovered", "disconnected"].includes(observation.connectionState)
    )
    if (!candidates.length) return
    const promptKey = `relay-existing-agents-prompt:${effectiveWorkspaceId}`
    if (window.localStorage.getItem(promptKey)) return
    window.localStorage.setItem(promptKey, "shown")
    toast.custom(
      (toastId) => (
        <div className="w-[420px] rounded-[4px] border border-[var(--claw-border)] bg-[var(--claw-bg-surface)] p-4 shadow-2xl">
          <div className="text-sm font-medium text-zinc-100">
            Existing agents found
          </div>
          <div className="mt-2 text-xs leading-5 text-zinc-400">
            {candidates.length} Hermes or OpenClaw agent
            {candidates.length === 1 ? " is" : "s are"} available. Connecting
            shares only allowlisted instructions, memory, and Markdown skills
            with Relay and lets supported edits sync both ways. Native skills
            keep running on your runtime host; secrets, logs, caches, generated
            files, and previous conversations stay outside Relay. Disconnecting
            later leaves the native agents and their files in place.
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => toast.dismiss(toastId)}
            >
              Not now
            </Button>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => {
                setSection("settings")
                setSettingsView("existing_agents")
                toast.dismiss(toastId)
              }}
            >
              Choose agents
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => {
                setNativeDocumentConsent(true)
                connectNativeObservationsMutation.mutate(
                  candidates.map((candidate) => candidate.id)
                )
                toast.dismiss(toastId)
              }}
            >
              Connect all
            </Button>
          </div>
        </div>
      ),
      {
        duration: Number.POSITIVE_INFINITY,
      }
    )
  }, [
    effectiveWorkspaceId,
    isWorkspaceAdmin,
    nativeObservationsQuery.data,
    connectNativeObservationsMutation,
    setNativeDocumentConsent,
    setSection,
    setSettingsView,
  ])

  return {
    bridgeDevicesQuery,
    runtimeAuthorityQuery,
    runtimeProvisioningTargetsQuery,
    nativeObservationsQuery,
    connectNativeObservationsMutation,
    retryNativeObservationMutation,
    disconnectNativeObservationMutation,
    dismissNativeObservationMutation,
    scanRuntimeHostMutation,
    selectRuntimeProvisioningTargetMutation,
  }
}

"use client"

import type { Dispatch, SetStateAction } from "react"
import { useEffect } from "react"
import { useMutation, type QueryClient } from "@tanstack/react-query"
import type {
  Paginated,
  RelayEntitlements,
  WebSession,
  Workspace,
} from "@clawchat/contracts"
import { toast } from "sonner"
import type { AppSection } from "@/components/app-shell/app-sidebar"
import { sdk } from "@/lib/sdk"
import { captureProductEvent } from "@/lib/telemetry"

type RelayAccountActionsInput = {
  accountDeletionConfirmationDraft: string
  accountDeletionPasswordDraft: string
  billingConfirmationPending: boolean
  billingReturn: string | null
  clearSensitiveAuthDrafts: () => void
  confirmPasswordDraft: string
  confirmResetPassword: string
  currentPasswordDraft: string
  effectiveWorkspaceId?: string | null
  email: string
  emailChangeToken: string | null
  emailVerificationToken: string | null
  firstWorkspaceSection: AppSection
  inviteCode: string
  name: string
  newPasswordDraft: string
  password: string
  passwordResetToken: string | null
  queryClient: QueryClient
  serverEntitlements?: RelayEntitlements | null
  session?: WebSession | null
  settingsUserEmailDraft: string
  settingsUserNameDraft: string
  settingsWorkspaceNameDraft: string
  setAccountDeletionConfirmationDraft: Dispatch<SetStateAction<string>>
  setAccountDeletionPasswordDraft: Dispatch<SetStateAction<string>>
  setAuthMode: Dispatch<SetStateAction<"login" | "register">>
  setBillingConfirmationPending: Dispatch<SetStateAction<boolean>>
  setBillingReturn: Dispatch<SetStateAction<string | null>>
  setConfirmPasswordDraft: Dispatch<SetStateAction<string>>
  setCurrentPasswordDraft: Dispatch<SetStateAction<string>>
  setEmailChangeToken: Dispatch<SetStateAction<string | null>>
  setEmailVerificationToken: Dispatch<SetStateAction<string | null>>
  setNewPasswordDraft: Dispatch<SetStateAction<string>>
  setPasswordResetToken: Dispatch<SetStateAction<string | null>>
  setSection: Dispatch<SetStateAction<AppSection>>
  setSelectedApprovalId: Dispatch<SetStateAction<string | null>>
  setSelectedThreadId: Dispatch<SetStateAction<string | null>>
  setSelectedWorkspaceId: Dispatch<SetStateAction<string | null>>
  setSettingsView: (value: "billing") => void
  setSettingsWorkspaceNameDraft: Dispatch<SetStateAction<string>>
  setWorkspaceNameDraft: Dispatch<SetStateAction<string>>
  workspaceNameDraft: string
  workspaceTypeDraft: "personal" | "business"
}

export function useRelayAccountActions({
  accountDeletionConfirmationDraft,
  accountDeletionPasswordDraft,
  billingConfirmationPending,
  billingReturn,
  clearSensitiveAuthDrafts,
  confirmPasswordDraft,
  confirmResetPassword,
  currentPasswordDraft,
  effectiveWorkspaceId,
  email,
  emailChangeToken,
  emailVerificationToken,
  firstWorkspaceSection,
  inviteCode,
  name,
  newPasswordDraft,
  password,
  passwordResetToken,
  queryClient,
  serverEntitlements,
  session,
  settingsUserEmailDraft,
  settingsUserNameDraft,
  settingsWorkspaceNameDraft,
  setAccountDeletionConfirmationDraft,
  setAccountDeletionPasswordDraft,
  setAuthMode,
  setBillingConfirmationPending,
  setBillingReturn,
  setConfirmPasswordDraft,
  setCurrentPasswordDraft,
  setEmailChangeToken,
  setEmailVerificationToken,
  setNewPasswordDraft,
  setPasswordResetToken,
  setSection,
  setSelectedApprovalId,
  setSelectedThreadId,
  setSelectedWorkspaceId,
  setSettingsView,
  setSettingsWorkspaceNameDraft,
  setWorkspaceNameDraft,
  workspaceNameDraft,
  workspaceTypeDraft,
}: RelayAccountActionsInput) {
  const loginMutation = useMutation({
    mutationFn: () => sdk.auth.login(email, password),
    onSuccess: (result) => {
      captureProductEvent("product_action", {
        action: "auth.login",
        outcome: "success",
      })
      clearSensitiveAuthDrafts()
      queryClient.setQueryData(["session"], result)
      toast.success(`Signed in as ${result.user.name}`)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const registerMutation = useMutation({
    mutationFn: () => sdk.auth.register(name, email, password, inviteCode),
    onSuccess: (result) => {
      captureProductEvent("product_action", {
        action: "auth.register",
        outcome: "success",
      })
      clearSensitiveAuthDrafts()
      queryClient.setQueryData(["session"], result)
      setAuthMode("login")
      toast.success("Account created")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const logoutMutation = useMutation({
    mutationFn: () => sdk.auth.logout(),
    onSuccess: () => {
      captureProductEvent("product_action", {
        action: "auth.logout",
        outcome: "success",
      })
      clearSensitiveAuthDrafts()
      queryClient.clear()
      setSelectedThreadId(null)
      setSelectedApprovalId(null)
      setSection("setup")
      toast.success("Signed out")
    },
    onError: (error: Error) => toast.error(`Sign out failed: ${error.message}`),
  })

  const changePasswordMutation = useMutation({
    mutationFn: () => {
      if (newPasswordDraft.length < 8) {
        throw new Error("New password must be at least 8 characters.")
      }
      if (newPasswordDraft !== confirmPasswordDraft) {
        throw new Error("New passwords do not match.")
      }
      return sdk.auth.changePassword(currentPasswordDraft, newPasswordDraft)
    },
    onSuccess: () => {
      setCurrentPasswordDraft("")
      setNewPasswordDraft("")
      setConfirmPasswordDraft("")
      clearSensitiveAuthDrafts()
      queryClient.clear()
      setSelectedThreadId(null)
      setSelectedApprovalId(null)
      setSection("setup")
      toast.success("Password changed. Sign in again to continue.")
    },
    onError: (error: Error) =>
      toast.error(`Password change failed: ${error.message}`),
  })

  const revokeWebSessionMutation = useMutation({
    mutationFn: (sessionId: string) => sdk.auth.revokeSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["auth", "web-sessions", session?.user.id],
      })
      await queryClient.invalidateQueries({ queryKey: ["session"] })
      toast.success("Browser session revoked")
    },
    onError: (error: Error) =>
      toast.error(`Could not revoke session: ${error.message}`),
  })

  const revokeAllWebSessionsMutation = useMutation({
    mutationFn: () => sdk.auth.revokeAllSessions(),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ["auth", "web-sessions", session?.user.id],
      })
      toast.success(
        result.revokedSessionIds.length
          ? "Other browser sessions revoked"
          : "No other active browser sessions"
      )
    },
    onError: (error: Error) =>
      toast.error(`Could not revoke sessions: ${error.message}`),
  })

  const passwordResetMutation = useMutation({
    mutationFn: () => sdk.auth.requestPasswordReset(email),
    onSuccess: (result) => toast.success(result.message),
    onError: (error: Error) => toast.error(error.message),
  })

  const completePasswordResetMutation = useMutation({
    mutationFn: () => {
      if (!passwordResetToken)
        throw new Error("Password reset link is missing.")
      if (password.length < 8) {
        throw new Error("New password must be at least 8 characters.")
      }
      if (password !== confirmResetPassword) {
        throw new Error("New passwords do not match.")
      }
      return sdk.auth.completePasswordReset(passwordResetToken, password)
    },
    onSuccess: (result) => {
      setPasswordResetToken(null)
      clearSensitiveAuthDrafts()
      toast.success(result.message)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const verifyEmailMutation = useMutation({
    mutationFn: (token: string) => sdk.auth.verifyEmail(token),
    onSuccess: async (result) => {
      setEmailVerificationToken(null)
      await queryClient.invalidateQueries({ queryKey: ["session"] })
      toast.success(result.message)
    },
    onError: (error: Error) => {
      setEmailVerificationToken(null)
      toast.error(`Email could not be verified: ${error.message}`)
    },
  })
  const verifyEmail = verifyEmailMutation.mutate
  const isVerifyingEmail = verifyEmailMutation.isPending

  const resendEmailVerificationMutation = useMutation({
    mutationFn: () => sdk.auth.resendEmailVerification(),
    onSuccess: () => toast.success("Verification email sent."),
    onError: (error: Error) =>
      toast.error(`Verification email could not be sent: ${error.message}`),
  })

  const emailChangeRequestMutation = useMutation({
    mutationFn: () => {
      const newEmail = settingsUserEmailDraft.trim().toLowerCase()
      if (!newEmail) {
        throw new Error("Enter the new email address.")
      }
      if (newEmail === session?.user.email.toLowerCase()) {
        throw new Error("Enter a different email address.")
      }
      if (!currentPasswordDraft) {
        throw new Error("Enter your current password.")
      }
      return sdk.auth.requestEmailChange({
        newEmail,
        currentPassword: currentPasswordDraft,
      })
    },
    onSuccess: (result) => {
      setCurrentPasswordDraft("")
      toast.success(result.message)
    },
    onError: (error: Error) =>
      toast.error(`Email change could not be requested: ${error.message}`),
  })

  const completeEmailChangeMutation = useMutation({
    mutationFn: (token: string) => sdk.auth.completeEmailChange(token),
    onSuccess: (result) => {
      setEmailChangeToken(null)
      setCurrentPasswordDraft("")
      clearSensitiveAuthDrafts()
      queryClient.clear()
      setSelectedThreadId(null)
      setSelectedApprovalId(null)
      setSection("setup")
      toast.success(`${result.message} Sign in again to continue.`)
    },
    onError: (error: Error) => {
      setEmailChangeToken(null)
      toast.error(`Email could not be changed: ${error.message}`)
    },
  })
  const completeEmailChange = completeEmailChangeMutation.mutate
  const isCompletingEmailChange = completeEmailChangeMutation.isPending

  useEffect(() => {
    if (emailVerificationToken && !isVerifyingEmail) {
      verifyEmail(emailVerificationToken)
    }
  }, [emailVerificationToken, isVerifyingEmail, verifyEmail])

  useEffect(() => {
    if (emailChangeToken && !isCompletingEmailChange) {
      completeEmailChange(emailChangeToken)
    }
  }, [completeEmailChange, emailChangeToken, isCompletingEmailChange])

  useEffect(() => {
    if (!billingReturn) return
    if (billingReturn === "success") {
      toast.success("Relay checkout completed. Confirming your subscription...")
      setBillingConfirmationPending(true)
      if (effectiveWorkspaceId) {
        void queryClient.invalidateQueries({
          queryKey: ["cloud-entitlements", effectiveWorkspaceId],
        })
      }
      setSection("settings")
      setSettingsView("billing")
    } else if (billingReturn === "cancelled") {
      toast.message("Relay checkout was cancelled. You have not been charged.")
    }
    setBillingReturn(null)
  }, [
    billingReturn,
    effectiveWorkspaceId,
    queryClient,
    setBillingConfirmationPending,
    setBillingReturn,
    setSection,
    setSettingsView,
  ])

  useEffect(() => {
    if (!billingConfirmationPending) return
    if (serverEntitlements?.mode === "read_write") {
      setBillingConfirmationPending(false)
      toast.success("Your Relay plan is active.")
      return
    }
    const timeout = window.setTimeout(() => {
      setBillingConfirmationPending(false)
      toast.message(
        "Payment was received, but Relay is still confirming the subscription. Refresh Billing settings in a moment."
      )
    }, 60_000)
    return () => window.clearTimeout(timeout)
  }, [
    billingConfirmationPending,
    serverEntitlements?.mode,
    setBillingConfirmationPending,
  ])

  const accountExportMutation = useMutation({
    mutationFn: () => sdk.auth.exportAccount(),
    onSuccess: (payload) => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `relay-console-account-export-${new Date().toISOString()}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success("Account export prepared")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const accountDeletionMutation = useMutation({
    mutationFn: () =>
      sdk.auth.deleteAccount(
        accountDeletionPasswordDraft,
        accountDeletionConfirmationDraft
      ),
    onSuccess: (result) => {
      setAccountDeletionPasswordDraft("")
      setAccountDeletionConfirmationDraft("")
      clearSensitiveAuthDrafts()
      queryClient.clear()
      toast.success(result.message)
    },
    onError: (error: Error) =>
      toast.error(`Account was not deleted: ${error.message}`),
  })

  const billingCheckoutMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveWorkspaceId) throw new Error("Select a workspace first.")
      return sdk.cloud.createCheckout(
        effectiveWorkspaceId,
        "relay_connect_monthly"
      )
    },
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
    onError: (error: Error) =>
      toast.error(`Checkout could not start: ${error.message}`),
  })

  const billingPortalMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveWorkspaceId) throw new Error("Select a workspace first.")
      return sdk.cloud.createBillingPortal(effectiveWorkspaceId)
    },
    onSuccess: ({ portalUrl }) => window.location.assign(portalUrl),
    onError: (error: Error) =>
      toast.error(`Billing portal could not open: ${error.message}`),
  })

  const workspaceCreateMutation = useMutation({
    mutationFn: () =>
      sdk.workspaces.create({
        name: workspaceNameDraft.trim(),
        type: workspaceTypeDraft,
      }),
    onSuccess: async (workspaceResult) => {
      captureProductEvent("product_action", {
        action: "workspace.create",
        outcome: "success",
        workspace_type: workspaceResult.type,
      })
      setWorkspaceNameDraft("")
      setSelectedWorkspaceId(workspaceResult.id)
      setSection(firstWorkspaceSection)
      queryClient.setQueryData<Paginated<Workspace>>(
        ["workspaces", session?.user.id],
        (current) => {
          if (!current) {
            return {
              data: [workspaceResult],
              total: 1,
              page: 1,
              pageSize: 1,
              hasMore: false,
            }
          }

          const data = [
            workspaceResult,
            ...current.data.filter((item) => item.id !== workspaceResult.id),
          ]
          return {
            ...current,
            data,
            total: Math.max(current.total, data.length),
          }
        }
      )
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] })
      toast.success("Workspace created")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const profileUpdateMutation = useMutation({
    mutationFn: () =>
      sdk.auth.updateProfile({
        name: settingsUserNameDraft.trim(),
      }),
    onSuccess: async (user) => {
      queryClient.setQueryData(["session"], (current: typeof session) =>
        current ? { ...current, user } : current
      )
      await queryClient.invalidateQueries({ queryKey: ["session"] })
      toast.success("Profile updated")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const workspaceUpdateMutation = useMutation({
    mutationFn: () =>
      sdk.workspaces.update(effectiveWorkspaceId!, {
        name: settingsWorkspaceNameDraft.trim(),
      }),
    onSuccess: async (updatedWorkspace) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
        queryClient.invalidateQueries({
          queryKey: ["workspace", effectiveWorkspaceId],
        }),
      ])
      setSettingsWorkspaceNameDraft(updatedWorkspace.name)
      toast.success("Workspace updated")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return {
    loginMutation,
    registerMutation,
    logoutMutation,
    changePasswordMutation,
    revokeWebSessionMutation,
    revokeAllWebSessionsMutation,
    passwordResetMutation,
    completePasswordResetMutation,
    emailChangeRequestMutation,
    resendEmailVerificationMutation,
    accountExportMutation,
    accountDeletionMutation,
    billingCheckoutMutation,
    billingPortalMutation,
    workspaceCreateMutation,
    profileUpdateMutation,
    workspaceUpdateMutation,
  }
}

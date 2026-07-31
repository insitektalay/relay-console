"use client"

import {
  backendUnavailableMessage,
  useRelayConsoleController,
  type RelayConsoleWebAppProps,
} from "@/components/app-shell/use-relay-console-controller"
export type {
  AgentGroupType,
  AgentManagementTab,
  AgentStructureCreateTarget,
  InsightsTab,
  NewChatMode,
  PublicSettingsView,
  RelayConsoleController,
  RelayConsoleWebAppProps,
  ThreadFilterGroup,
} from "@/components/app-shell/use-relay-console-controller"
import { RelayConsoleAuthenticatedShell } from "@/components/app-shell/relay-console-authenticated-shell"

import { RefreshCcw } from "lucide-react"

import {
  LoginScreen,
  PasswordResetScreen,
} from "@/components/auth/login-screen"
import { DesktopShell } from "@/components/app-shell/desktop-shell"

import { ThreadListPane } from "@/components/threads/thread-list-pane"
import { ThreadDetailPane } from "@/components/threads/thread-detail-pane"
import { EmptyState } from "@/components/shared/empty-state"

import { Button } from "@/components/ui/button"

function AuthCheckingShell() {
  return (
    <DesktopShell
      header={
        <div className="h-14 border-b border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)] bg-[var(--claw-bg-page)] px-5" />
      }
      sidebar={
        <div className="min-h-0 border-r border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)]">
          <ThreadListPane
            search=""
            onSearchChange={() => undefined}
            isLoading
            errorMessage={null}
            threads={[]}
            agents={[]}
            departments={[]}
            selectedThreadId={null}
            onSelectThread={() => undefined}
            relativeTime={(value) => value}
            actions={null}
          />
        </div>
      }
      detailPane={
        <ThreadDetailPane
          selectedThread={null}
          isLoading
          messages={[]}
          agents={[]}
          departments={[]}
          currentUserAvatarUrl={undefined}
          messageDraft=""
          onMessageDraftChange={() => undefined}
          onSendMessage={() => undefined}
          isSending={false}
          typingUsers={[]}
          isAwaitingAgentReply={false}
          relativeTime={(value) => value}
          initials={(value) => value.slice(0, 2).toUpperCase()}
        />
      }
    />
  )
}

function BackendUnavailableShell({
  isRetrying,
  message,
  onRetry,
}: {
  isRetrying: boolean
  message: string
  onRetry: () => void
}) {
  return (
    <DesktopShell
      header={
        <div className="h-14 border-b border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)] bg-[var(--claw-bg-page)] px-5" />
      }
      sidebar={
        <div className="min-h-0 border-r border-[color-mix(in_srgb,var(--claw-border)_28%,transparent)]">
          <ThreadListPane
            search=""
            onSearchChange={() => undefined}
            isLoading={false}
            errorMessage={message}
            threads={[]}
            agents={[]}
            departments={[]}
            selectedThreadId={null}
            onSelectThread={() => undefined}
            relativeTime={(value) => value}
            actions={null}
          />
        </div>
      }
      detailPane={
        <div className="flex h-full items-center justify-center px-6">
          <div className="w-full max-w-md space-y-4">
            <EmptyState
              title="Relay service unavailable"
              description={message}
            />
            <Button
              className="w-full"
              disabled={isRetrying}
              onClick={onRetry}
              type="button"
              variant="secondary"
            >
              <RefreshCcw className="size-4" />
              {isRetrying ? "Retrying..." : "Retry"}
            </Button>
          </div>
        </div>
      }
    />
  )
}

export function RelayConsoleWebApp(props: RelayConsoleWebAppProps) {
  const controller = useRelayConsoleController(props)
  const {
    authMode,
    authScreenErrorMessage,
    authScreenStatusMessage,
    clearSensitiveAuthDrafts,
    completePasswordResetMutation,
    confirmResetPassword,
    email,
    inviteCode,
    loginMutation,
    name,
    password,
    passwordResetMutation,
    passwordResetToken,
    registerMutation,
    session,
    sessionQuery,
    setAuthMode,
    setConfirmResetPassword,
    setEmail,
    setInviteCode,
    setName,
    setPassword,
    setPasswordResetToken,
  } = controller

  if (passwordResetToken) {
    return (
      <PasswordResetScreen
        password={password}
        confirmPassword={confirmResetPassword}
        onPasswordChange={setPassword}
        onConfirmPasswordChange={setConfirmResetPassword}
        onSubmit={() => completePasswordResetMutation.mutate()}
        onCancel={() => {
          setPasswordResetToken(null)
          clearSensitiveAuthDrafts()
        }}
        isSubmitting={completePasswordResetMutation.isPending}
        errorMessage={
          completePasswordResetMutation.error instanceof Error
            ? completePasswordResetMutation.error.message
            : null
        }
      />
    )
  }

  if (sessionQuery.isLoading) {
    return <AuthCheckingShell />
  }

  if (sessionQuery.isError && !session) {
    return (
      <BackendUnavailableShell
        isRetrying={sessionQuery.isFetching}
        message={backendUnavailableMessage(sessionQuery.error)}
        onRetry={() => {
          void sessionQuery.refetch()
        }}
      />
    )
  }

  if (!session) {
    return (
      <LoginScreen
        title={
          authMode === "login"
            ? "Relay Console"
            : "Create your Relay Console account"
        }
        description={
          authMode === "login"
            ? "Desktop control for your AI workforce."
            : "Register a Relay Console account, then build the workspace from the browser."
        }
        name={name}
        email={email}
        password={password}
        inviteCode={inviteCode}
        onNameChange={authMode === "register" ? setName : undefined}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onInviteCodeChange={authMode === "register" ? setInviteCode : undefined}
        onPasswordReset={
          authMode === "login"
            ? () => passwordResetMutation.mutate()
            : undefined
        }
        onSubmit={() => {
          if (authMode === "login") {
            loginMutation.mutate()
          } else {
            registerMutation.mutate()
          }
        }}
        isSubmitting={
          loginMutation.isPending ||
          registerMutation.isPending ||
          passwordResetMutation.isPending
        }
        submitLabel={
          authMode === "login" ? "Sign in to Relay Console" : "Create account"
        }
        secondaryLabel={
          authMode === "login" ? "Create a new account" : "Back to sign in"
        }
        onSecondaryAction={() =>
          setAuthMode((current) => (current === "login" ? "register" : "login"))
        }
        errorMessage={authScreenErrorMessage}
        statusMessage={authScreenStatusMessage}
      />
    )
  }

  return <RelayConsoleAuthenticatedShell controller={controller} />
}

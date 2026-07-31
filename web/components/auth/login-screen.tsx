import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function LoginScreen({
  title = "Relay Console",
  description = "Desktop control for your AI workforce.",
  name,
  email,
  password,
  inviteCode,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onInviteCodeChange,
  onSubmit,
  onPasswordReset,
  isSubmitting,
  submitLabel = "Sign in to Relay Console",
  secondaryLabel,
  onSecondaryAction,
  errorMessage,
  statusMessage,
}: {
  title?: string
  description?: string
  name?: string
  email: string
  password: string
  inviteCode?: string
  onNameChange?: (value: string) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onInviteCodeChange?: (value: string) => void
  onSubmit: () => void
  onPasswordReset?: () => void
  isSubmitting: boolean
  submitLabel?: string
  secondaryLabel?: string
  onSecondaryAction?: () => void
  errorMessage?: string | null
  statusMessage?: string | null
}) {
  const isRegistering = Boolean(onNameChange)
  const describedBy = [
    errorMessage ? "relay-auth-error" : null,
    statusMessage ? "relay-auth-status" : null,
    onPasswordReset ? "relay-auth-support-note" : null,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="mission-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div className="mission-grid" />
      <Card className="relative z-10 w-full max-w-md border-white/8 bg-black/20 shadow-2xl shadow-black/40 backdrop-blur-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/16 bg-primary/10 shadow-[0_0_24px_rgba(96,165,250,0.12)]">
              <Image
                src="/brand/relay-console-logo.png"
                alt=""
                width={36}
                height={36}
                className="size-8"
                priority
              />
            </div>
            <div>
              <div className="mission-kicker">Desktop node</div>
              <CardTitle className="claw-title-page tracking-[-0.03em]">
                {title}
              </CardTitle>
              <CardDescription className="mission-subtle">
                {description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="space-y-3"
            aria-describedby={describedBy || undefined}
            onSubmit={(event) => {
              event.preventDefault()
              if (!isSubmitting) onSubmit()
            }}
          >
            {onNameChange ? (
              <div className="space-y-1.5">
                <label className="mission-kicker" htmlFor="relay-auth-name">
                  Name
                </label>
                <Input
                  id="relay-auth-name"
                  name="name"
                  autoComplete="name"
                  value={name ?? ""}
                  onChange={(event) => onNameChange(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label className="mission-kicker" htmlFor="relay-auth-email">
                Email
              </label>
              <Input
                id="relay-auth-email"
                name="email"
                autoComplete="email"
                type="email"
                required
                aria-invalid={Boolean(errorMessage)}
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="mission-kicker" htmlFor="relay-auth-password">
                Password
              </label>
              <Input
                id="relay-auth-password"
                name="password"
                autoComplete={isRegistering ? "new-password" : "current-password"}
                type="password"
                required
                aria-invalid={Boolean(errorMessage)}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </div>
            {onInviteCodeChange ? (
              <div className="space-y-1.5">
                <label className="mission-kicker" htmlFor="relay-auth-invite">
                  Beta invite code
                </label>
                <Input
                  id="relay-auth-invite"
                  name="inviteCode"
                  autoComplete="off"
                  value={inviteCode ?? ""}
                  onChange={(event) => onInviteCodeChange(event.target.value)}
                />
              </div>
            ) : null}
            {errorMessage ? (
              <p
                id="relay-auth-error"
                role="alert"
                className="rounded-[4px] border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100"
              >
                {errorMessage}
              </p>
            ) : null}
            {statusMessage ? (
              <p
                id="relay-auth-status"
                role="status"
                className="rounded-[4px] border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100"
              >
                {statusMessage}
              </p>
            ) : null}
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Submitting..." : submitLabel}
            </Button>
          </form>
          {onPasswordReset ? (
            <div className="space-y-2">
              <Button
                className="w-full"
                variant="ghost"
                type="button"
                disabled={isSubmitting || !email.trim()}
                onClick={onPasswordReset}
              >
                Request password reset
              </Button>
              <p
                id="relay-auth-support-note"
                className="claw-meta leading-5 text-zinc-500"
              >
                If an account exists for that address, Relay sends a one-time
                reset link. The response never reveals whether the account
                exists.
              </p>
            </div>
          ) : null}
          {secondaryLabel && onSecondaryAction ? (
            <Button
              className="w-full"
              variant="outline"
              type="button"
              disabled={isSubmitting}
              onClick={onSecondaryAction}
            >
              {secondaryLabel}
            </Button>
          ) : null}
          <p className="claw-meta leading-5 text-zinc-500">
            Uses the Railway control plane for HTTP and the same realtime
            channel shape as mobile.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export function PasswordResetScreen({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onCancel,
  isSubmitting,
  errorMessage,
}: {
  password: string
  confirmPassword: string
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  isSubmitting: boolean
  errorMessage?: string | null
}) {
  return (
    <div className="mission-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div className="mission-grid" />
      <Card className="relative z-10 w-full max-w-md border-white/8 bg-black/20 shadow-2xl shadow-black/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            The reset link works once. Completing it signs out every existing
            Relay Console session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!isSubmitting) onSubmit()
            }}
          >
            <Input
              aria-label="New password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
            <Input
              aria-label="Confirm new password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
            />
            {errorMessage ? (
              <p role="alert" className="rounded-[4px] border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {errorMessage}
              </p>
            ) : null}
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Resetting..." : "Reset password"}
            </Button>
            <Button className="w-full" disabled={isSubmitting} variant="ghost" type="button" onClick={onCancel}>
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

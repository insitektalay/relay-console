export type BetaSignupEmailConfig = {
  resendApiKey: string
  destinationEmail: string
  fromEmail: string
}

const DEFAULT_FROM_EMAIL = "Relay Console Beta <onboarding@resend.dev>"

export function getBetaSignupEmailConfig(
  env: NodeJS.ProcessEnv = process.env
): BetaSignupEmailConfig | null {
  const resendApiKey = env.RESEND_API_KEY?.trim()

  if (!resendApiKey) {
    return null
  }

  const destinationEmail = env.BETA_SIGNUP_TO_EMAIL?.trim()

  if (!destinationEmail) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "BETA_SIGNUP_TO_EMAIL is required when RESEND_API_KEY is configured in production."
      )
    }
    return null
  }

  return {
    resendApiKey,
    destinationEmail,
    fromEmail: env.BETA_SIGNUP_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL,
  }
}

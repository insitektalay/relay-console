import { NextRequest, NextResponse } from "next/server"
import { getBetaSignupEmailConfig } from "@/lib/beta-signup-config"

const DEFAULT_RAILWAY_ORIGIN = "https://your-backend.up.railway.app"
const isProduction = process.env.NODE_ENV === "production"

function isLoopbackHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  )
}

function getRailwayHttpOrigin() {
  const configuredValue = process.env.CLAWCHAT_RAILWAY_ORIGIN?.trim()
  if (isProduction && !configuredValue) {
    throw new Error(
      "Relay Console beta signup requires CLAWCHAT_RAILWAY_ORIGIN in production."
    )
  }

  const rawValue = configuredValue || DEFAULT_RAILWAY_ORIGIN
  let url: URL
  try {
    url = new URL(rawValue)
  } catch {
    throw new Error("CLAWCHAT_RAILWAY_ORIGIN must be a valid absolute URL.")
  }

  if (url.protocol !== "https:") {
    throw new Error("CLAWCHAT_RAILWAY_ORIGIN must use https:.")
  }

  if (isLoopbackHostname(url.hostname)) {
    throw new Error(
      "Relay Console beta signup is Railway-only. CLAWCHAT_RAILWAY_ORIGIN cannot target a local backend."
    )
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      "CLAWCHAT_RAILWAY_ORIGIN must be an origin only, without path, query, or hash."
    )
  }

  return url.origin
}

const RAILWAY_ORIGIN = getRailwayHttpOrigin()

const EMAIL_PATTERN = /^[^\s@<>"'`()[\]{};:,\\]+@[^\s@<>"'`()[\]{};:,\\]+\.[^\s@<>"'`()[\]{};:,\\]{2,}$/i

function isSafeEmail(value: string) {
  const email = value.trim()
  return (
    email.length > 3 &&
    email.length <= 254 &&
    !/[\u0000-\u001f\u007f]/.test(email) &&
    EMAIL_PATTERN.test(email)
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

async function saveWaitlistSignup(email: string, request: NextRequest) {
  const headers = new Headers({ "Content-Type": "application/json" })
  const origin = request.headers.get("origin")
  const userAgent = request.headers.get("user-agent")
  const forwardedFor = request.headers.get("x-forwarded-for")

  if (origin) headers.set("Origin", origin)
  if (userAgent) headers.set("User-Agent", userAgent)
  if (forwardedFor) headers.set("X-Forwarded-For", forwardedFor)

  const response = await fetch(`${RAILWAY_ORIGIN}/api/v1/waitlist`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, source: "landing_page" }),
  })

  if (!response.ok) {
    throw new Error("Could not save beta request.")
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 })
  }

  const email =
    payload && typeof payload === "object" && "email" in payload
      ? String(payload.email).trim()
      : ""

  if (!isSafeEmail(email)) {
    return NextResponse.json(
      { message: "Enter a valid email address." },
      { status: 400 }
    )
  }

  const escapedEmail = escapeHtml(email)
  const origin = request.headers.get("origin") ?? "Unknown origin"
  const userAgent = request.headers.get("user-agent") ?? "Unknown user agent"
  let emailConfig: ReturnType<typeof getBetaSignupEmailConfig>

  try {
    emailConfig = getBetaSignupEmailConfig()
  } catch {
    console.error("Beta signup notification email is misconfigured.")
    return NextResponse.json(
      { message: "Beta signup is temporarily unavailable." },
      { status: 500 }
    )
  }

  try {
    await saveWaitlistSignup(email, request)
  } catch {
    return NextResponse.json(
      { message: "Could not save beta request." },
      { status: 502 }
    )
  }

  if (!emailConfig) {
    return NextResponse.json({ message: "Beta request received." })
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${emailConfig.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailConfig.fromEmail,
      to: [emailConfig.destinationEmail],
      subject: "New Relay Console beta request",
      text: [
        "New Relay Console beta request",
        "",
        `Email: ${email}`,
        `Origin: ${origin}`,
        `User agent: ${userAgent}`,
      ].join("\n"),
      html: `
        <h2>New Relay Console beta request</h2>
        <p><strong>Email:</strong> ${escapedEmail}</p>
        <p><strong>Origin:</strong> ${escapeHtml(origin)}</p>
        <p><strong>User agent:</strong> ${escapeHtml(userAgent)}</p>
      `,
      reply_to: email,
    }),
  })

  if (!response.ok) {
    console.error("Could not send beta signup notification email.")
  }

  return NextResponse.json({ message: "Beta request received." })
}

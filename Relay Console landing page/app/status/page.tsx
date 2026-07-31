import type { Metadata } from "next";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = {
  title: "Relay service status | Relay Console",
  description: "Live Relay control-plane checks and help for account, sync, and runtime problems.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_TIMEOUT_MS = 5_000;

function relayAPIBaseURL() {
  const configuredOrigin = process.env.CLAWCHAT_RAILWAY_ORIGIN?.trim();
  if (!configuredOrigin) return null;

  try {
    const url = new URL(configuredOrigin);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return `${url.origin}/api/v1`;
  } catch {
    return null;
  }
}

const RELAY_API_BASE_URL = relayAPIBaseURL();

type HealthPayload = {
  ok?: boolean;
};

type CheckResult = {
  known: boolean;
  ok: boolean;
};

type IncidentResult = {
  known: boolean;
  active: boolean;
  severity?: "minor" | "major" | "critical";
  summary?: string;
};

async function checkLiveness(): Promise<CheckResult> {
  if (!RELAY_API_BASE_URL) return { known: false, ok: false };
  try {
    const response = await fetch(`${RELAY_API_BASE_URL}/health`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    const payload = (await response.json()) as HealthPayload;
    return {
      known: true,
      ok: response.ok && payload.ok === true,
    };
  } catch {
    return { known: false, ok: false };
  }
}

async function checkIncident(): Promise<IncidentResult> {
  if (!RELAY_API_BASE_URL) return { known: false, active: false };
  try {
    const response = await fetch(`${RELAY_API_BASE_URL}/deployment/manifest`, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    const body = (await response.json()) as {
      data?: {
        support?: {
          status?: unknown;
          incident?: { severity?: unknown; summary?: unknown } | null;
        };
      };
    };
    if (!response.ok || !body.data?.support) return { known: false, active: false };
    const incident = body.data.support.incident;
    const active = body.data.support.status === "incident" && Boolean(incident);
    if (!active) return { known: true, active: false };
    return {
      known: true,
      active: true,
      severity: safeSeverity(incident?.severity),
      summary: safePublicSummary(incident?.summary),
    };
  } catch {
    return { known: false, active: false };
  }
}

function statusCopy(health: CheckResult, incident: IncidentResult) {
  if (incident.active) {
    return {
      label: "Service issue",
      detail: "Relay has posted an active incident. Read the incident update below.",
      badge: "border-red-400/30 bg-red-400/10 text-red-300",
    };
  }
  if (health.ok) {
    return {
      label: "Operational",
      detail: "The Relay control-plane API is accepting requests and no active incident is posted.",
      badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    };
  }
  if (health.known && !health.ok) {
    return {
      label: "Service issue",
      detail: "The Relay control plane reported a failed liveness check. Relay features may be unavailable.",
      badge: "border-red-400/30 bg-red-400/10 text-red-300",
    };
  }
  return {
    label: "Status check unavailable",
    detail: "This page could not reach the status endpoints. Check again before assuming an outage.",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  };
}

function safeSeverity(value: unknown): "minor" | "major" | "critical" {
  return value === "critical" || value === "major" || value === "minor" ? value : "major";
}

function safePublicSummary(value: unknown) {
  if (typeof value !== "string") return "Relay is investigating a service issue.";
  const summary = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return summary ? summary.slice(0, 500) : "Relay is investigating a service issue.";
}

function componentLabel(result: CheckResult) {
  if (!result.known) return "Check unavailable";
  return result.ok ? "Operational" : "Service issue";
}

export default async function StatusPage() {
  const [health, incident] = await Promise.all([
    checkLiveness(),
    checkIncident(),
  ]);
  const current = statusCopy(health, incident);

  return (
    <PolicyPage
      title="Relay service status"
      description="Check sync, the web app, mobile access, and the Relay control plane. Your agent runtime remains on the computer you chose to operate."
      eyebrow="Live service check"
      updatedLabel="Checked during this page request"
    >
      <section className="rounded-2xl border border-[color:var(--border)] bg-white/[0.025] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0">Current status</h2>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${current.badge}`}>
            {current.label}
          </span>
        </div>
        <p>{current.detail}</p>
      </section>

      <h2>Services</h2>
      <dl className="divide-y divide-[color:var(--border)] rounded-2xl border border-[color:var(--border)]">
        <div className="flex items-start justify-between gap-5 p-4 sm:p-5">
          <div>
            <dt className="font-medium text-foreground">Relay control-plane API</dt>
            <dd>Sign-in, sync, messages, agents, and bridge connections.</dd>
          </div>
          <dd className="shrink-0 text-right font-medium text-foreground">
            {componentLabel(health)}
          </dd>
        </div>
      </dl>

      <h2>Incident updates</h2>
      {incident.active ? (
        <section className="rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.16em] text-red-300">
            {incident.severity} incident
          </p>
          <p className="mb-0 text-foreground">{incident.summary}</p>
        </section>
      ) : incident.known ? (
        <p>No active Relay service incident is posted.</p>
      ) : (
        <p>The incident feed could not be checked. The live service checks above may still work.</p>
      )}

      <h2>Your agent runtime</h2>
      <p>
        Hermes Agent or OpenClaw runs on a computer you control. Keep that computer awake, online,
        and connected through the Relay bridge when you want to use its agents from the web,
        iPhone, or iPad. A runtime problem can affect your agents while the Relay control plane remains
        operational.
      </p>

      <h2>Report a problem</h2>
      <p>
        Check <a href="/known-issues">known issues</a>, then email{" "}
        <a href="mailto:hello@relayconsole.work">hello@relayconsole.work</a> with the time, affected
        device, app version, and error text. Remove tokens, private messages, and personal data
        from anything you send.
      </p>
    </PolicyPage>
  );
}

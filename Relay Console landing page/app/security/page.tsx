import type { Metadata } from "next";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Security | Relay Console" };

export default function SecurityPage() {
  return (
    <PolicyPage
      title="Security"
      description="This beta security overview describes implemented controls and remaining launch checks without claiming an uncompleted certification."
    >
      <h2>Account and session controls</h2>
      <p>
        Relay accounts use hashed passwords, short-lived access tokens, rotating hashed refresh
        tokens, CSRF protection for browser sessions, email verification, one-time password-reset
        links, session/device revocation, and rate limits. Password-reset completion revokes all
        existing sessions.
      </p>
      <h2>Secrets and connections</h2>
      <p>
        Provider credentials and OAuth verifier material are encrypted before database storage.
        Bridge credentials and action tokens are stored only as hashes. Connection packages,
        exports, logs, and support bundles must not contain raw secrets.
      </p>
      <h2>Runtime boundary</h2>
      <p>
        You secure and update the computer or server running Hermes Agent or
        OpenClaw. The Relay bridge makes an outbound authenticated connection
        and does not grant Relay general host access.
      </p>
      <h2>Operational status</h2>
      <p>
        Production-environment checks fail closed on missing or unsafe core secrets and invalid
        Railway origins. Independent penetration testing, final incident coverage, restore drills,
        and a published vulnerability-disclosure process remain launch gates.
      </p>
    </PolicyPage>
  );
}

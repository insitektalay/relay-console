import type { Metadata } from "next";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Support | Relay Console" };

export default function SupportPage() {
  return (
    <PolicyPage
      title="Support"
      description="Get help with Relay, your account, or a runtime bridge."
      eyebrow="Public beta support"
      updatedLabel="Support hours published: 15 July 2026"
    >
      <h2>Contact</h2>
      <p>
        Email <a href="mailto:hello@relayconsole.work">hello@relayconsole.work</a> with the app version,
        macOS version, Mac model, the action you attempted, and the error text. Remove credentials,
        tokens, private messages, and personal data before sending logs or screenshots.
      </p>
      <h2>Response time</h2>
      <p>
        Beta support is monitored Monday to Friday, 09:00–17:00 UK time, excluding public
        holidays in England and Wales. We aim to send an initial response within two business
        days. Relay Console does not include 24-hour or emergency support.
      </p>
      <h2>Security reports</h2>
      <p>
        Put “Confidential security report” in the subject line and do not include live secrets.
        We aim to acknowledge a security report within two business days, then provide a private
        triage update after its severity and scope are understood.
      </p>
      <h2>Service status</h2>
      <p>
        Check <a href="/status">Relay service status</a> and{" "}
        <a href="/known-issues">known issues</a> before sending a report. Check
        that the computer running Hermes Agent or OpenClaw is awake and its
        bridge is connected.
      </p>
    </PolicyPage>
  );
}

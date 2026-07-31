import type { Metadata } from "next";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Acceptable use | Relay Console" };

export default function AcceptableUsePage() {
  return (
    <PolicyPage
      title="Acceptable use"
      description="These draft rules apply to human and agent activity through Relay Console. Legal approval is required before launch."
    >
      <h2>Use accounts you control</h2>
      <p>
        Connect only runtimes, models, applications, data, and identities you are authorized to
        use. Do not bypass access controls, provider consent, organization policy, rate limits, or
        account restrictions.
      </p>
      <h2>Review consequential actions</h2>
      <p>
        Keep approval enabled for sending messages, publishing, payments, destructive changes,
        permissions, administration, production changes, and actions that affect another person.
        You remain responsible for actions performed through your accounts.
      </p>
      <h2>Prohibited activity</h2>
      <p>
        Do not use Relay Console for malware, credential theft, unauthorized surveillance,
        harassment, fraud, spam, illegal content, safety-control evasion, privacy violations, or
        attempts to expose secrets. Do not use automation to defeat CAPTCHA, two-factor
        authentication, legal attestations, payment confirmation, or human review.
      </p>
      <h2>Enforcement</h2>
      <p>
        Relay may block a Marketplace capability, connection, bridge, or cloud account when needed
        to contain abuse or protect the service. A final notice, appeal, and termination process
        must be approved before public launch.
      </p>
    </PolicyPage>
  );
}

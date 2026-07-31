import type { Metadata } from "next";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Terms | Relay Console" };

export default function TermsPage() {
  return (
    <PolicyPage
      title="Public beta terms"
      description="These draft terms describe an experimental beta. A legal reviewer must supply the contracting entity, governing law, and final terms before launch."
    >
      <h2>Beta status</h2>
      <p>
        Relay Console is pre-release software. Features may fail, change, or disappear. Do not use
        the beta as the sole system for urgent, regulated, financial, medical, legal, or safety-
        critical work.
      </p>
      <h2>Your responsibility</h2>
      <p>
        You control the accounts, files, prompts, agents, and app permissions that you add. Review
        agent actions before they affect another person, publish content, change records, or spend
        money. Keep backups of data you cannot replace.
      </p>
      <h2>Third-party services</h2>
      <p>
        Hermes Agent, OpenClaw, OpenAI, and connected app providers supply separate products.
        Their terms, account rules, plans, model access, limits, and availability apply. Relay
        Console does not provide or resell those accounts.
      </p>
      <h2>Relay subscription</h2>
      <p>
        The subscription is named Relay Monthly and has a one-month duration. Its US
        reference price is US$9.99 per month; your checkout or App Store purchase sheet shows the
        local price, tax and final total before payment. It renews automatically for another month
        until cancelled and has no introductory trial at launch. Cancellation takes effect at the
        end of the paid period. Failed payments receive a three-day grace
        period.
      </p>
      <p>
        Relay does not yet accept web subscription purchases. Web checkout
        remains disabled until Relay names the legal seller, completes Stripe
        verification, and confirms the required tax registrations and sale
        countries.
      </p>
      <h2>Temporary offline access on Mac</h2>
      <p>
        After the Mac app verifies an active subscription online, it may cache
        that verification for seven consecutive days. Same-Mac use may continue
        during that period. Features that need the Relay service, including
        synchronization and web, iPhone, iPad, or remote-host access, remain
        unavailable while the service cannot be reached. After seven days, the
        Mac app permits reading local conversations and exporting Relay data,
        but disables agent execution until it verifies an active subscription
        online. This offline period does not extend the separate three-day
        failed-payment grace.
      </p>
      <p>
        Cancellation takes effect at the end of the paid period. When the
        entitlement expires, Relay disables agent execution, synchronization,
        remote access, control-plane writes, and Marketplace actions. The Mac
        app continues to allow local conversation reading, export, reset, and
        account deletion.
      </p>
      <p>
        Relay keeps primary Railway workspace data read-only and exportable for
        30 days after entitlement expiry. Reactivation during that period
        restores the retained workspace. Relay deletes the primary workspace
        content after 30 days; later reactivation starts fresh Railway state
        and may resynchronize supported data that remains on your Mac.
      </p>
      <h2>Apple purchases</h2>
      <p>
        Apple processes subscriptions bought in the iPhone or iPad app and charges your Apple
        Account after purchase confirmation. Manage or cancel that subscription in your Apple
        Account subscription settings and use Restore Purchases in Relay Console when needed.
        Apple handles App Store billing and refund requests under its policies. Apple&apos;s standard
        Licensed Application End User License Agreement applies to the downloaded app unless Relay
        submits an approved custom EULA; these product terms cover the Relay
        account, connected services, and acceptable use.
      </p>
      <h2>Receipts, invoices, and refunds</h2>
      <p>
        When web sales begin, Stripe will supply receipts and invoices through
        checkout and the customer billing portal. Relay will honour mandatory
        consumer refund rights and may approve other web refunds case by case.
        Apple supplies App Store purchase records and handles App Store refund
        requests under its policies.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not use Relay Console to break the law, bypass access controls, distribute malware,
        invade privacy, or act through an account without permission. Provider restrictions still
        apply when an agent performs an action for you.
      </p>
      <h2>Warranty and liability draft</h2>
      <p>
        The beta comes without a service-level commitment. Legal counsel must approve warranty,
        liability, indemnity, termination, governing-law, and dispute terms before publication.
        This draft does not fill those clauses with placeholder legal claims.
      </p>
      <h2>Contact</h2>
      <p>
        Send terms questions to <a href="mailto:hello@relayconsole.work">hello@relayconsole.work</a>.
      </p>
    </PolicyPage>
  );
}

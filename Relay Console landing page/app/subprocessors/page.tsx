import type { Metadata } from "next";
import { PolicyPage } from "../policy-page";

export const metadata: Metadata = { title: "Subprocessors | Relay Console" };

export default function SubprocessorsPage() {
  return (
    <PolicyPage
      title="Subprocessors"
      description="This draft inventory separates services in use from services planned for the paid launch. Regions and contractual details require final review."
    >
      <h2>Currently used</h2>
      <ul>
        <li>Railway: Relay account and control-plane hosting, PostgreSQL, Redis, queues, service logs, and backups when enabled.</li>
        <li>Vercel: public website and browser application hosting, delivery, and access/security logs.</li>
        <li>PostHog: allowlisted product analytics from Mac, iPhone, iPad, and web only after the user enables product analytics.</li>
        <li>Sentry: bounded crash and error diagnostics from Mac, iPhone, iPad, and web only after the user enables crash reporting.</li>
      </ul>
      <h2>Planned when the related feature is enabled</h2>
      <ul>
        <li>Stripe: web checkout, recurring subscription billing, tax collection configuration, invoices, receipts, and customer billing portal.</li>
        <li>Resend: account verification and password-reset email delivery.</li>
        <li>Apple: iPhone/iPad app distribution and in-app subscription processing, if approved and enabled.</li>
      </ul>
      <h2>Support</h2>
      <p>
        Launch support currently uses Relay&apos;s published email address. No separate customer
        support or ticketing subprocessor has been selected. This inventory must be updated before
        any additional support, analytics, monitoring, payment, or email service receives customer
        data.
      </p>
      <h2>User-selected providers</h2>
      <p>
        The customer selects and controls Hermes Agent, OpenClaw, model
        providers, runtime hosts, and Marketplace applications.
      </p>
    </PolicyPage>
  );
}

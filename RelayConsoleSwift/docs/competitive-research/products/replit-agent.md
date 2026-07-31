# Replit Agent

## Summary

Replit Agent is Replit's AI app-building agent. Replit's Agent docs say it “turns your ideas into apps, designs, slides, and more, all from plain language” with no coding required: https://docs.replit.com/references/agent/overview.md. Replit is a strong comparable where Relay Console is evaluated against products that combine agentic work, cloud development environments, deployable artifacts, connectors, task planning, and team governance.

## Jobs/use cases

- Build apps, websites, designs, slides, mobile apps, animations, and other artifacts from natural language: https://docs.replit.com/references/agent/overview.md.
- Use Agent to build, debug, iterate, and plan work in a cloud development environment; Replit Core docs mention Agent, Full build, Lite build, Design Canvas, Visual Editor, Plan Mode, and all artifact types: https://docs.replit.com/billing/plans/replit-core.md.
- Use connectors to integrate with third-party services such as Google and Stripe: https://docs.replit.com/billing/plans/replit-core.md.
- Track task planning with Kanban and run active background tasks; Replit AI Billing lists one active background task for Core and ten for Pro: https://docs.replit.com/billing/ai-billing.md.
- Enterprise teams can use SSO/SAML with SCIM, RBAC, audit logging via SIEM, admin governance controls, security scanning/CVEs/SBOM, custom-scoped first-party integrations, and unlimited seats: https://docs.replit.com/billing/plans/replit-enterprise.md.

## Feature overlap with Relay Console

- Agent operations and background tasks overlap with Relay Console's local runtime workspace/dashboard, dispatch, Hermes cron scheduler, Agent Ops services, and artifact library.
- Connectors/integrations overlap with Relay Console's provider connection services, marketplace installs, provider wrapper tools, provider action broker, and approval inbox.
- Artifact generation and deployment overlap with Relay Console's artifact/evidence story, but Replit is centered on building and publishing software artifacts.
- Enterprise governance/audit features are a useful benchmark for Relay Console's permission policy, audit security, approval services, and future admin packaging.

## Where it differs

- Replit Agent is primarily a cloud app-building and publishing platform; Relay Console local code is a macOS Swift app that manages local runtime harnesses, provider-action tools, approvals, cron, artifacts, and evidence.
- Replit includes a cloud development environment and publishing/deployment system; Relay Console's inspected files do not position it as a hosted IDE or app deployment platform.
- Replit's enterprise controls are publicly packaged around organizational app-building governance; Relay Console's local code shows foundations for permission/audit/approval but public packaging was not verified in this repo.

## Pricing/packaging if relevant

Replit AI Billing says all subscribers receive one-time free Agent checkpoints and monthly credits are included for Core and Pro subscribers; credits cover Agent and other Replit cloud services. It lists Agent feature differences by Starter/Core/Pro, including Starter daily caps, Core/Pro Full build, Plan Mode, Connectors, task planning, and active background task limits: https://docs.replit.com/billing/ai-billing.md. Replit Core docs direct readers to the pricing page for current Core pricing: https://docs.replit.com/billing/plans/replit-core.md.

## Distribution/ecosystem

Replit is a hosted browser-based building/deployment platform with AI agent features, connectors, cloud development resources, one-click publishing, secrets, logs/analytics, and enterprise workspace governance per the Core and Enterprise docs: https://docs.replit.com/billing/plans/replit-core.md and https://docs.replit.com/billing/plans/replit-enterprise.md.

## Evidence/source links

- Replit Agent docs: https://docs.replit.com/references/agent/overview.md
- Replit AI Billing: https://docs.replit.com/billing/ai-billing.md
- Replit Core plan docs: https://docs.replit.com/billing/plans/replit-core.md
- Replit Enterprise docs: https://docs.replit.com/billing/plans/replit-enterprise.md
- Replit AI product page checked: https://replit.com/ai
- Replit pricing page checked: https://replit.com/pricing

## Open questions

- Which current source provides stable exact Core/Pro prices and credit quantities without relying on dynamic pricing-page extraction?
- Should Relay Console integrate with Replit as a cloud app-building target, or treat Replit primarily as a vertical software-building competitor?
- What approval/human-in-the-loop controls exist around Replit Agent actions, connectors, deployments, and background tasks beyond enterprise governance controls?

## Last updated

2026-06-28

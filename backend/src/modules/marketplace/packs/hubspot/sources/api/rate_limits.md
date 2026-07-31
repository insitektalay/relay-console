# HubSpot Rate Limits and Quotas

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Official docs: https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines

HubSpot documents app/account API limits by auth/distribution model and subscription tier. CRM Search has its own stricter limit: five requests per second per account. HubSpot returns `429` when limits are exceeded.

Use paging cursors, explicit properties, bounded time windows, and documented batch endpoints. Do not fan out writes across contacts, companies, deals, tickets, lists, or owners without approval.

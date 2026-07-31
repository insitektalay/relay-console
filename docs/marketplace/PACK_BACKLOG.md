# Marketplace Pack Backlog

## Reference Pack Queue

Status values:

- `reference_complete`: app has been deepened in-place, passes the canonical audit, has OpenClaw/Hermes output proof, and has no known generic/cross-provider residue from spot-checks.
- `blocked`: official docs or product decisions prevent provider-specific hardening; include evidence.

## Final State

The marketplace reference-pack queue is complete.

- Total marketplace apps: 49.
- Reference complete apps: 49.
- Apps still queued: none.
- Apps in progress: none.
- Apps blocked: none.
- Apps review-needed: none.

## Reference Complete

- GitHub: `reference_complete` - retained curated reference pack.
- Stripe: `reference_complete` - retained curated reference pack.
- Slack: `reference_complete` - Slack OAuth, scopes, Web API methods, conversation/thread/file/reaction/Event API doctrine, approval gates, and rate-limit handling.
- Notion: `reference_complete` - Notion OAuth/internal integration auth, capabilities, page/database/data-source/block/comment doctrine, parent-sharing constraints, API method families, and approval gates.
- Linear: `reference_complete` - Linear GraphQL auth, OAuth/API-key scopes, organization/team/issue/project/cycle/workflow-state doctrine, query/mutation method families, and approval gates.
- Resend: `reference_complete` - Resend API-key auth, verified-domain/DNS, email/batch/broadcast, audience/contact, API-key, webhook, approval, and rate-limit doctrine.
- Twilio: `reference_complete` - Twilio Account/Subaccount SID auth, Messages/Calls/Conversations, Messaging Services, phone-number, status-callback, webhook, compliance, and approval doctrine.
- Supabase: `reference_complete` - Supabase project refs, anon/service_role/Management API context, PostgREST, Auth Admin, Storage, Edge Functions, RLS/policies, database webhooks, and approval gates.
- Gmail: `reference_complete` - Google OAuth Gmail scopes, messages/threads/drafts/labels/history/watch APIs, MIME/raw payloads, attachment handling, push notifications, safe mail workflows, and approval gates.
- Outlook: `reference_complete` - Microsoft Graph OAuth permissions, messages/folders/drafts/reply/forward/move/attachments APIs, Graph change notifications, safe mail workflows, and approval gates.
- Google Drive: `reference_complete` - Google OAuth Drive scopes, files/folders/shared drives/shortcuts/permissions/changes APIs, export-vs-download doctrine, ownership/sharing gates.
- Airtable: `reference_complete` - Airtable PAT/OAuth scopes, bases/tables/views/fields/records APIs, filterByFormula/pagination, metadata schema, webhooks, record/schema approval gates.
- Dropbox: `reference_complete` - Dropbox OAuth scopes, files/list_folder cursors, file/path/rev metadata, namespaces/team folders, shared links, file locks, webhook deltas, approval gates.
- Coda: `reference_complete` - Coda API token auth, docs/pages/tables/rows/columns/formulas/controls APIs, row/cell payloads, webhook endpoints, doc/table approval gates.
- Jira: `reference_complete` - Atlassian OAuth/API-token scopes, Jira Cloud sites, projects/issues/JQL/transitions/comments/worklogs/boards/sprints/webhooks, approval gates.
- Asana: `reference_complete` - Asana OAuth/PAT access, workspaces/teams/projects/sections/tasks/stories/custom fields/portfolios/webhooks, approval gates.
- Trello: `reference_complete` - Trello API key/token access, workspaces/boards/lists/cards/checklists/members/labels/actions/webhooks, approval gates.
- ClickUp: `reference_complete` - ClickUp OAuth/token access, teams/spaces/folders/lists/tasks/statuses/custom fields/comments/docs/webhooks, approval gates.
- Confluence: `reference_complete` - Atlassian OAuth/API-token scopes, Confluence spaces/pages/content/attachments/labels/versions/comments/whiteboards/webhooks, approval gates.
- GitLab: `reference_complete` - GitLab OAuth/PAT/project-token scopes, groups/projects/repositories/branches/MRs/issues/pipelines/jobs/environments/protected refs/webhooks, approval gates.
- Vercel: `reference_complete` - Vercel bearer-token/team access, projects/deployments/domains/aliases/env vars/team members/webhooks, production deployment approval gates.
- Railway: `reference_complete` - Railway API-token GraphQL access, workspaces/projects/environments/services/deployments/variables/domains/webhooks, production deployment and variable approval gates.
- Sentry: `reference_complete` - Sentry auth/OAuth scopes, organizations/projects/issues/events/releases/alerts/teams/integrations/webhooks, privacy-sensitive event gates.
- PostHog: `reference_complete` - PostHog personal/project API keys, projects/events/persons/insights/dashboards/cohorts/feature flags/session replays/CDP destinations, privacy/export approval gates.
- Shopify: `reference_complete` - Shopify Admin GraphQL/REST auth, access scopes, shops/products/variants/orders/customers/inventory/fulfillments/refunds/webhooks, money/order/inventory approval gates.
- Paddle: `reference_complete` - Paddle API-key auth, customers/products/prices/transactions/subscriptions/adjustments/webhooks, billing-impact approval gates.
- Lemon Squeezy: `reference_complete` - Lemon Squeezy API auth, stores/products/variants/orders/subscriptions/licenses/webhooks, digital-product and license approval gates.
- Chargebee: `reference_complete` - Chargebee API-key auth, customers/items/item prices/subscriptions/invoices/hosted pages/events/webhooks, billing approval gates.
- HubSpot: `reference_complete` - HubSpot private app/OAuth auth, CRM objects, contacts/companies/deals/tickets/properties/associations/pipelines/webhooks, CRM approval gates.
- Salesforce: `reference_complete` - Salesforce OAuth, REST API, sObjects, SOQL/SOSL, Accounts/Contacts/Opportunities/Cases, composite APIs, platform events/change data capture, approval gates.
- Zendesk: `reference_complete` - Zendesk API-token/OAuth auth, tickets/users/organizations/groups/macros/triggers/search/webhooks, support approval gates.
- Intercom: `reference_complete` - Intercom OAuth/access-token auth, conversations/contacts/admins/teams/messages/webhooks, customer-message approval gates.
- Pipedrive: `reference_complete` - Pipedrive API-token/OAuth auth, deals/persons/organizations/activities/pipelines/stages/webhooks, sales pipeline approval gates.
- Figma: `reference_complete` - Figma OAuth/PAT auth, files/file keys/nodes/components/component sets/styles/comments/images/teams/projects/webhooks, export/comment/private-data approval gates.
- Canva: `reference_complete` - Canva Connect OAuth scopes, designs/folders/assets/brand templates/exports/uploads/comments/webhooks, brand/export approval gates.
- Webflow: `reference_complete` - Webflow OAuth/site-token auth, sites/pages/collections/items/CMS fields/assets/forms/domains/publishing/webhooks, staging-vs-production approval gates.
- WordPress: `reference_complete` - WordPress REST API, application passwords/OAuth/JWT boundaries, posts/pages/media/users/comments/categories/tags/custom post types/revisions/statuses, publishing/moderation/admin approval gates.
- YouTube Data API: `reference_complete` - YouTube OAuth/API-key auth, videos/channels/playlists/playlistItems/commentThreads/comments/captions/thumbnails/subscriptions/live resources/quota/push notifications, upload/comment/channel approval gates.
- Discord: `reference_complete` - Discord bot tokens/OAuth2, applications/guilds/channels/messages/threads/members/users/roles/interactions/webhooks/Gateway/rate limits, public-post/moderation/admin approval gates.
- X: `reference_complete` - X OAuth, Posts API, users, timelines, Direct Messages, Lists, publishing, engagement, and approval-gated public/DM actions.
- Facebook Pages: `reference_complete` - Meta Graph/Page access, Page posts, comments, media, insights, webhooks, and approval-gated Page publishing/moderation.
- Instagram Graph API: `reference_complete` - Instagram professional account auth, media containers, content publishing, comments, mentions, insights, and approval-gated publishing/moderation.
- Threads: `reference_complete` - Threads OAuth, posts, replies, media containers, insights, reply management, and approval-gated publishing.
- LinkedIn: `reference_complete` - LinkedIn OAuth, member/organization posts, social actions, media assets, comments, likes, and approval-gated professional publishing.
- TikTok: `reference_complete` - TikTok OAuth, Content Posting API, creator info, upload/status polling, and approval-gated video publishing.
- Pinterest: `reference_complete` - Pinterest OAuth, boards, Pins, media, analytics, and approval-gated Pin/board operations.
- Reddit: `reference_complete` - Reddit OAuth, subreddits, posts, comments, modqueue, moderation surfaces, and approval-gated submissions/mod actions.
- Mastodon: `reference_complete` - Mastodon instance OAuth, statuses, timelines, notifications, media, federation-aware interactions, and approval-gated posting/moderation.
- Bluesky: `reference_complete` - Bluesky/AT Protocol auth, records, posts, feeds, profiles, labels, likes, reposts, and approval-gated record writes.

## Final Gate

The final reconciliation pass confirmed:

1. `pnpm --dir backend build` passed.
2. `pnpm --dir web typecheck` passed.
3. `pnpm --dir backend marketplace:generate-all-packs` passed with 49 total apps, 49 curated, 0 failed generation, and 0 apps needing review.
4. `pnpm --dir backend marketplace:audit-canonical-packs` passed with 0 false curated, 0 review-needed, 0 blocked, and passing compiled-output secret scan.
5. GitHub and Stripe regression output counts remain valid.
6. One app from each major category was spot-checked for provider-specific doctrine and absence of generic template residue: Slack, Gmail, Jira, GitLab, Shopify, HubSpot, and Figma.

## Future Factory Inputs

- Provider-specific source URL enrichments per app.
- OpenAPI importer from URL or file.
- Postman collection importer.
- MCP manifest/tool schema importer.
- Persisted generation jobs and reviews.
- Review promotion workflow.

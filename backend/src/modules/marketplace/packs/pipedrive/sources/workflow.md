# Pipedrive Workflow Router

Use Pipedrive for sales CRM workflows involving persons, organizations, deals, leads, pipelines, stages, activities, notes, products, users, filters, fields, and webhooks.

Do not use Pipedrive for unapproved customer/prospect outreach, destructive bulk CRM actions, company deletion, human impersonation, or secret exposure.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.pipedrive.com/docs/api/v1
- https://pipedrive.readme.io/docs/core-api-concepts-about-pipedrive-api
- https://pipedrive.readme.io/docs/core-api-concepts-authentication
- https://pipedrive.readme.io/docs/marketplace-oauth-api
- https://pipedrive.readme.io/docs/core-api-concepts-rate-limiting
- https://pipedrive.readme.io/docs/guide-for-webhooks
- https://pipedrive.readme.io/docs/guide-for-optimizing-api-usage

## Routing Doctrine

1. Confirm company domain, auth type, user/company context, OAuth/API-token scope, and target object type.
2. Resolve person, organization, deal, lead, pipeline, stage, owner/user, activity, note, product, filter, and custom field ids before writes.
3. Treat deal/lead pipeline, stage, status, value, close date, owner, and activity completion as sales-impacting and approval-required when mutated.
4. Draft notes, activities, contact changes, deal/lead changes, product links, pipeline/stage moves, filters, and webhooks before executing.
5. Require approval for customer/prospect-visible outreach, bulk updates, exports, merges/deletes, owner changes at scale, pipeline/stage/admin/filter/product/webhook/field changes, and destructive actions.

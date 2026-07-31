# Confluence Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
- https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
- https://developer.atlassian.com/platform/forge/manifest-reference/scopes-product-confluence/
- https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/
- https://developer.atlassian.com/cloud/confluence/rate-limiting/
- https://developer.atlassian.com/cloud/confluence/modules/webhook/

## Provider Permission Model

Relevant permissions include read:page:confluence, write:page:confluence, read:space:confluence, write:attachment:confluence. Schema/admin changes and bulk data writes require approval.

## Capability Mapping

- Read capability: use Confluence REST v2 spaces, pages, content body, attachments, labels, versions, comments, whiteboards, descendants/ancestors, and search with bounded pagination.
- Draft capability: prepare exact Confluence page create/update/archive, body representation, parent move, attachment, label, comment, restriction, space, or webhook payloads without side effects.
- Write capability: create/update Confluence pages, comments, labels, attachments, and page hierarchy only when Atlassian scopes and space/page permissions allow it.
- Admin capability: Confluence space configuration, page restrictions, public/external sharing, webhooks, space/page deletion, bulk page moves/archives, and destructive content operations; disabled by default.

# LinkedIn API Overview

Auth model: LinkedIn OAuth 2.0 with approved Community Management or Marketing products. Validate member identity, organization URN, admin role, and product access before organization writes.

Object model: Person URNs, organization URNs, posts, commentary, lifecycleState, visibility, media assets, social actions, comments, likes, analytics where product access allows.

Endpoint families:
- POST https://api.linkedin.com/rest/posts creates member or organization posts after approval.
- GET https://api.linkedin.com/rest/posts/{encodedUrn} reads posts.
- Use author URNs such as urn:li:person:{id} or urn:li:organization:{id}.
- Social actions/comment endpoints read or create comments where approved.
- Requests require LinkedIn-Version: YYYYMM and X-Restli-Protocol-Version: 2.0.0 for Rest.li APIs.

Rate limits/quotas: LinkedIn rate limits depend on application, member, organization, and product. The pack must treat 429 and service-specific throttles as hard stops and record any response headers; do not claim fixed universal quotas.

Events/webhooks: Do not claim broad webhooks. Use only LinkedIn products/events documented for the app, otherwise use approved bounded reads.

Official docs:
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version

# LinkedIn Endpoint Families

## 1. POST https://api.linkedin.com/rest/posts creates member or organization posts after approval.

## 2. GET https://api.linkedin.com/rest/posts/{encodedUrn} reads posts.

## 3. Use author URNs such as urn:li:person:{id} or urn:li:organization:{id}.

## 4. Social actions/comment endpoints read or create comments where approved.

## 5. Requests require LinkedIn-Version: YYYYMM and X-Restli-Protocol-Version: 2.0.0 for Rest.li APIs.

Approval rule: do not call write/delete/moderation endpoints until the user has approved exact native account, native object ID, payload, and visibility.

Official docs:
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version

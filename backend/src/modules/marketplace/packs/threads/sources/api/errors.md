# Threads Errors And Failure Modes

Provider-specific failure modes:
- Missing permission/scope/product access or access-tier restriction.
- Native account mismatch or wrong target object.
- Rate limit/quota exceeded: Threads API limits are product and endpoint specific. The pack must honor documented response headers, container processing status, and publish limits; do not retry container publish loops without backoff.
- Unsupported capability claim, invalid media, invalid visibility/privacy option, or moderation/admin permission failure.
- Policy/community-rule risk: False DM capability, cross-post spam, automated replies, wrong profile, impersonation, policy bypass, repeated hashtag/engagement manipulation, and deleting/hiding replies without review.

Stop and ask for clarification rather than falling back to another account or unsupported endpoint.

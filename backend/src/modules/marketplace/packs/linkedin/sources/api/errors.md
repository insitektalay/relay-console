# LinkedIn Errors And Failure Modes

Provider-specific failure modes:
- Missing permission/scope/product access or access-tier restriction.
- Native account mismatch or wrong target object.
- Rate limit/quota exceeded: LinkedIn rate limits depend on application, member, organization, and product. The pack must treat 429 and service-specific throttles as hard stops and record any response headers; do not claim fixed universal quotas.
- Unsupported capability claim, invalid media, invalid visibility/privacy option, or moderation/admin permission failure.
- Policy/community-rule risk: Posting as wrong organization, unauthorized employee advocacy, undisclosed sponsorship/recruiting claims, comment manipulation, mass liking/commenting, and changing organization settings without approval.

Stop and ask for clarification rather than falling back to another account or unsupported endpoint.

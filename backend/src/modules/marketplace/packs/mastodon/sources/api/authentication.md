# Mastodon API Authentication

Instance-specific OAuth. Discover/register the app against the target instance, request granular scopes, and validate the account and instance rules before reads or writes.

Permission/scopes model:
- profile, read, read:statuses, read:notifications, write, write:statuses, write:media, write:follows, write:reports, admin:read:reports, admin:write:reports when moderation access is explicitly approved.

Token validation rules:
- Confirm the token maps to the intended native account/object before writes.
- Stop on missing scope/product access/product-access denial instead of attempting fallback behavior.
- Use the least privileged permission set for the workflow.

Official docs:
- https://docs.joinmastodon.org/api/oauth-scopes/
- https://docs.joinmastodon.org/methods/statuses/
- https://docs.joinmastodon.org/api/rate-limits/

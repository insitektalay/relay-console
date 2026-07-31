# WordPress Good Request Examples

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.wordpress.org/rest-api/
- https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/
- https://developer.wordpress.org/rest-api/reference/posts/
- https://developer.wordpress.org/rest-api/reference/pages/
- https://developer.wordpress.org/rest-api/reference/media/
- https://developer.wordpress.org/rest-api/reference/comments/
- https://developer.wordpress.org/rest-api/reference/users/

## Good Requests

- List draft WordPress posts updated this week with author, status and missing featured image.
- Summarize pending comments for moderation without approving or deleting them.
- Prepare a post update diff for slug spring-launch but leave it as a draft.

## Why These Are Good

- They identify a bounded target.
- They favor reads, summaries or drafts.
- They do not expose secrets or create unapproved external side effects.

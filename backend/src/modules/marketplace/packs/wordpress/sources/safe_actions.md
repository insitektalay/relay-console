# WordPress Safe Actions

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

## Allowed Without Additional Approval

- Read accessible resources and summarize state.
- Draft comments, replies, posts, content updates, publishing plans and moderation recommendations.
- Prepare exact API payloads for review without sending them.

## Approval Required

- Publish post 123 to the public site.
- Delete media attachment 456.
- Approve, trash or mark spam on these customer comments.

## Blocked

- Give me the application password.
- Make my account an administrator.
- Disable security plugins or moderation settings.

## Sensitive Risk Areas

- publishing public posts/pages before editorial approval
- comment moderation affecting community trust
- media uploads exposing copyrighted or private assets
- user/admin role changes and settings/plugin/theme boundaries
- custom post types with site-specific fields

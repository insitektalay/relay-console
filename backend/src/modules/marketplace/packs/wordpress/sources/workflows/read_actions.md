# WordPress Read Workflows

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

## Read Workflow

1. Confirm connection, scope and resource boundary.
2. Resolve target IDs from official endpoints.
3. Fetch only fields/items needed for the user request.
4. Summarize state without exposing secrets or unnecessary personal/private content.

## Good Read Requests

- List draft WordPress posts updated this week with author, status and missing featured image.
- Summarize pending comments for moderation without approving or deleting them.
- Prepare a post update diff for slug spring-launch but leave it as a draft.

# WordPress Endpoints

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

## Representative Endpoints

- GET/POST /wp-json/wp/v2/posts and /pages
- GET/POST /wp-json/wp/v2/media
- GET/POST/PATCH/DELETE /wp-json/wp/v2/comments
- GET /wp-json/wp/v2/categories and /tags
- GET /wp-json/wp/v2/users and /users/me
- GET /wp-json/wp/v2/types and custom post type bases
- GET /wp-json/wp/v2/posts/{id}/revisions

## Method Guidance

- GET/list endpoints are preferred for discovery and summaries.
- POST/PATCH/PUT/DELETE endpoints are side-effecting and must pass capability, permission and approval checks.
- For publish/export/moderation/admin endpoints, include exact target IDs and a rollback or remediation note where the provider supports one.

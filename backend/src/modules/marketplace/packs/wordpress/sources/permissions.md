# WordPress Permissions

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

## Provider Permission Model

- WordPress core uses user capabilities such as edit_posts, publish_posts, upload_files, moderate_comments, edit_users and manage_options instead of OAuth scopes for self-hosted REST requests.
- wordpress.com and plugin OAuth/JWT deployments have site-specific grants; record the exact plugin/provider before assuming behavior.

## Resource Boundaries

- posts, pages, revisions and statuses draft/pending/private/publish
- media attachments and upload metadata
- users, roles and capabilities
- comments and moderation state
- categories, tags and taxonomies
- custom post types exposed with show_in_rest
- settings, plugins and themes when endpoints are installed/enabled

## Safe Permission Checks

- Confirm read access before exports, uploads, moderation, publishing or webhook changes.
- Confirm the token/user/bot has the exact write/admin capability required by the endpoint.
- Treat missing access and 404 responses as possible permission boundaries, not as a reason to bypass controls.

# WordPress API Overview

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

## Provider Object Model

- posts, pages, revisions and statuses draft/pending/private/publish
- media attachments and upload metadata
- users, roles and capabilities
- comments and moderation state
- categories, tags and taxonomies
- custom post types exposed with show_in_rest
- settings, plugins and themes when endpoints are installed/enabled

## Endpoint Families

- Posts, Pages and Revisions: Draft and read freely within capability; publishing and deletion require approval.
- Media: Uploads and deletes can expose or remove public assets.
- Comments: Moderation writes require approval.
- Categories and Tags: Taxonomy changes affect public navigation and SEO.
- Users: User and role operations are admin/security sensitive.
- Custom Post Types: Only operate custom types exposed through show_in_rest after schema inspection.

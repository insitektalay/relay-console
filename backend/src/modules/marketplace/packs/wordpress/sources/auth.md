# WordPress Authentication

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

## Supported Auth Model

- Application Passwords over HTTPS for WordPress REST API user auth
- Cookie/nonce auth for same-origin admin flows
- OAuth/JWT only when a site has a vetted plugin or wordpress.com flow configured

## Required Handling

- Store tokens, client secrets, API keys, application passwords and webhook URLs only as ClawChat secrets.
- Redact Authorization headers and secret-bearing URLs from logs and generated docs.
- Verify token owner/account/site/team/guild/channel before using cached IDs.
- If auth fails, debug provider grant, scopes/capabilities, token expiry/revocation and resource-level access.

## Provider Scopes Or Permissions

- WordPress core uses user capabilities such as edit_posts, publish_posts, upload_files, moderate_comments, edit_users and manage_options instead of OAuth scopes for self-hosted REST requests.
- wordpress.com and plugin OAuth/JWT deployments have site-specific grants; record the exact plugin/provider before assuming behavior.

# WordPress API Authentication

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

## Authentication Families

- Application Passwords over HTTPS for WordPress REST API user auth
- Cookie/nonce auth for same-origin admin flows
- OAuth/JWT only when a site has a vetted plugin or wordpress.com flow configured

## Scopes, Grants And Capabilities

- WordPress core uses user capabilities such as edit_posts, publish_posts, upload_files, moderate_comments, edit_users and manage_options instead of OAuth scopes for self-hosted REST requests.
- wordpress.com and plugin OAuth/JWT deployments have site-specific grants; record the exact plugin/provider before assuming behavior.

## Secret Safety

- Do not put secrets in generated OpenClaw or Hermes outputs.
- Do not include bearer tokens, API keys, bot tokens, application passwords, webhook URLs with tokens, client secrets or refresh tokens in examples.
- When showing examples, use placeholder IDs and redacted headers.

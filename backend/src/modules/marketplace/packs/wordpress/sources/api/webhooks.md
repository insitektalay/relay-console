# WordPress Webhooks And Events

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

## Provider Events

- WordPress core REST API does not provide built-in webhooks; sites commonly add webhook behavior through plugins or custom REST endpoints.
- Do not create custom webhook endpoints, install plugins or change settings from this pack without explicit approval.

## Safety Rules

- Creating, changing or deleting webhook subscriptions requires approval.
- Validate signatures/secrets where the provider supports them.
- Redact webhook URLs, signing secrets and delivery payload secrets.
- Dedupe retries and avoid sending private payloads to unapproved external destinations.

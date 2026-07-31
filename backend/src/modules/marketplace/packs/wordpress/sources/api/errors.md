# WordPress Errors

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

## Failure Modes

- 401 rest_not_logged_in or invalid credentials means auth failed.
- 403 rest_cannot_create/rest_cannot_edit/rest_cannot_delete means the user lacks a required capability.
- 400 invalid parameter errors often come from status, slug, taxonomy, media or custom-field validation.

## Response Discipline

- Stop on auth, permission or ownership failures and ask for corrected access.
- Do not retry destructive or publishing calls blindly.
- Record provider error code/status and redacted request target in the audit summary.

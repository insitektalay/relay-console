# GitHub API Authentication Details

## Fine-grained PATs

Use for bounded, user-scoped installs on a specific repository set. GitHub documents endpoint-specific permission requirements for fine-grained tokens, and some endpoints support multiple valid permission sets.

## GitHub Apps

Use for organization or team-facing automation. GitHub Apps start with no permissions and should be granted only the repository or organization permissions required for the selected capabilities. Installation tokens are the preferred operating model for shared automation.

## SAML SSO behavior

- Fine-grained tokens must satisfy endpoint permission requirements.
- Classic PATs can encounter SAML SSO partial-results or authorization issues.
- GitHub App tokens are automatically authorized for SAML SSO.

## Security rule

Never store tokens, app private keys, client secrets, or webhook secrets in documentation, issue comments, PR descriptions, repository files, or chat output.

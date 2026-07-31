# GitHub Authentication and Setup

GitHub supports multiple API authentication models. For marketplace operation, use one of these:

1. GitHub App installation tokens for organization or shared repository automation.
2. Fine-grained personal access tokens for user-scoped access to a bounded set of repositories.

Do not prefer classic personal access tokens unless there is a clear provider limitation that forces them. They are broader than necessary for most marketplace use.

## Recommended choice

Use a GitHub App when:

- the agent acts across repositories or for an organization;
- you need installation-scoped permissions;
- you want cleaner least-privilege controls;
- you want SAML SSO compatibility without user re-authorization friction.

Use a fine-grained PAT when:

- the install is user-owned and limited to a small set of repositories;
- the user needs a faster manual setup path;
- the operations are narrow and repository-scoped.

## Least-privilege guidance

- Limit repository selection to the minimum set the agent must operate.
- Enable only the repository permissions needed for the selected capabilities.
- Prefer read-only contents access unless the install explicitly enables repository contents write.
- Separate read-only monitoring installs from write-capable delivery installs when possible.

## Authentication notes from GitHub's API model

- REST API endpoints declare whether they support GitHub App installation tokens, GitHub App user tokens, and fine-grained PATs.
- Fine-grained PATs require endpoint-specific repository permissions.
- GitHub Apps have no permissions by default; permissions must be selected during app registration.
- GitHub App access tokens are automatically authorized for SAML SSO.
- Username/password authentication is not supported for the REST API.

## Operator setup checklist

- Choose auth model: GitHub App or fine-grained PAT.
- Limit repository scope.
- Match permission grants to selected marketplace capabilities.
- Confirm whether webhook access is needed.
- Store credentials in the ClawChat marketplace connection only.

{{CONNECTION_CONTEXT}}

# LinkedIn API Authentication

LinkedIn OAuth 2.0 with approved Community Management or Marketing products. Validate member identity, organization URN, admin role, and product access before organization writes.

Permission/scopes model:
- w_member_social, r_member_social, w_organization_social, r_organization_social, rw_organization_admin as needed for member/organization publishing and admin validation.

Token validation rules:
- Confirm the token maps to the intended native account/object before writes.
- Stop on missing scope/product access/product-access denial instead of attempting fallback behavior.
- Use the least privileged permission set for the workflow.

Official docs:
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
- https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/protocol-version

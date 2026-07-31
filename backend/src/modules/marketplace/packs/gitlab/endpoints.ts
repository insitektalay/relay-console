export const GITLAB_ENDPOINT_FAMILIES = [
  { id: "family_1", label: "GET /projects", docsUrl: "https://docs.gitlab.com/api/rest/", guidance: "GET /projects" },
  { id: "family_2", label: "GET /projects/", docsUrl: "https://docs.gitlab.com/api/rest/authentication/", guidance: "GET /projects/:id/repository/files" },
  { id: "family_3", label: "GET/POST issues", docsUrl: "https://docs.gitlab.com/user/profile/personal_access_tokens/#personal-access-token-scopes", guidance: "GET/POST issues" },
  { id: "family_4", label: "GET/POST merge_requests", docsUrl: "https://docs.gitlab.com/api/projects/", guidance: "GET/POST merge_requests" },
  { id: "family_5", label: "pipeline/job endpoints", docsUrl: "https://docs.gitlab.com/security/rate_limits/", guidance: "pipeline/job endpoints" },
  { id: "family_6", label: "hooks endpoints", docsUrl: "https://docs.gitlab.com/user/project/integrations/webhooks/", guidance: "hooks endpoints" },
];

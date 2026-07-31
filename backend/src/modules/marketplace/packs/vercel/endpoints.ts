export const VERCEL_ENDPOINT_FAMILIES = [
  { id: "family_1", label: "GET /v6/deployments", docsUrl: "https://vercel.com/docs/rest-api", guidance: "GET /v6/deployments" },
  { id: "family_2", label: "GET /v13/deployments/{id}", docsUrl: "https://vercel.com/docs/rest-api#introduction/api-basics/authentication", guidance: "GET /v13/deployments/{id}" },
  { id: "family_3", label: "GET/POST /v9/projects", docsUrl: "https://vercel.com/docs/accounts/plans/pro/accounts/access-roles", guidance: "GET/POST /v9/projects" },
  { id: "family_4", label: "env var endpoints", docsUrl: "https://vercel.com/docs/rest-api/reference/endpoints/deployments", guidance: "env var endpoints" },
  { id: "family_5", label: "domains endpoints", docsUrl: "https://vercel.com/docs/integrations/webhooks-overview", guidance: "domains endpoints" },
  { id: "family_6", label: "webhooks endpoints", docsUrl: "https://vercel.com/docs/rest-api#introduction/api-basics/rate-limits", guidance: "webhooks endpoints" },
];

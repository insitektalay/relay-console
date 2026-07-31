export const SENTRY_ENDPOINT_FAMILIES = [
  { id: "family_1", label: "GET /api/0/organizations/{org}/issues/", docsUrl: "https://docs.sentry.io/api/", guidance: "GET /api/0/organizations/{org}/issues/" },
  { id: "family_2", label: "GET issue/events", docsUrl: "https://docs.sentry.io/api/auth/", guidance: "GET issue/events" },
  { id: "family_3", label: "GET projects", docsUrl: "https://docs.sentry.io/api/permissions/", guidance: "GET projects" },
  { id: "family_4", label: "releases endpoints", docsUrl: "https://docs.sentry.io/api/events/", guidance: "releases endpoints" },
  { id: "family_5", label: "issue update endpoints", docsUrl: "https://docs.sentry.io/api/ratelimits/", guidance: "issue update endpoints" },
  { id: "family_6", label: "webhook integration events", docsUrl: "https://docs.sentry.io/organization/integrations/integration-platform/webhooks/", guidance: "webhook integration events" },
];

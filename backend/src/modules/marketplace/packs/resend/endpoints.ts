export const RESEND_ENDPOINT_FAMILIES = [
  { id: "family_1", label: "POST /emails, GET /emails/{id}, POST /emails/batch", docsUrl: "https://resend.com/docs/api-reference/introduction", guidance: "POST /emails, GET /emails/{id}, POST /emails/batch" },
  { id: "family_2", label: "GET/POST /domains, GET/PATCH/DELETE /domains/{id}, POST /domains/{id}/verify", docsUrl: "https://resend.com/docs/api-reference/emails/send-email", guidance: "GET/POST /domains, GET/PATCH/DELETE /domains/{id}, POST /domains/{id}/verify" },
  { id: "family_3", label: "GET/POST /api-keys and DELETE /api-keys/{id}", docsUrl: "https://resend.com/docs/api-reference/rate-limit", guidance: "GET/POST /api-keys and DELETE /api-keys/{id}" },
  { id: "family_4", label: "GET/POST /audiences, GET/POST/PATCH/DELETE contacts within audiences", docsUrl: "https://resend.com/docs/dashboard/webhooks/introduction", guidance: "GET/POST /audiences, GET/POST/PATCH/DELETE contacts within audiences" },
  { id: "family_5", label: "Webhook event delivery endpoints configured in dashboard/API where supported", docsUrl: "https://resend.com/docs/api-reference/errors", guidance: "Webhook event delivery endpoints configured in dashboard/API where supported" },
];

export const INTERCOM_ENDPOINT_FAMILIES = [
  {
    id: "bounded_conversation_metadata",
    label: "Bounded Conversation Metadata",
    docsUrl:
      "https://developers.intercom.com/docs/references/rest-api/api.intercom.io/conversations/listconversations",
    guidance:
      "Use only fixed API 2.15 conversation count, bounded first-page list, and exact-ID retrieval wrappers; return allowlisted metadata and discard private content.",
  },
  {
    id: "verified_admin_authority",
    label: "Verified Workspace Authority",
    docsUrl:
      "https://developers.intercom.com/docs/references/rest-api/api.intercom.io/admins/identifyadmin",
    guidance:
      "Bind every request to the exact workspace id, regional API origin, and verified authorizing admin returned by /me.",
  },
];

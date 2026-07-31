export const TRELLO_ENDPOINT_FAMILIES = [
  { id: "family_1", label: "GET /1/boards/{id}", docsUrl: "https://developer.atlassian.com/cloud/trello/rest/", guidance: "GET /1/boards/{id}" },
  { id: "family_2", label: "GET/POST /1/cards", docsUrl: "https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/", guidance: "GET/POST /1/cards" },
  { id: "family_3", label: "PUT /1/cards/{id}", docsUrl: "https://developer.atlassian.com/cloud/trello/guides/rest-api/rate-limits/", guidance: "PUT /1/cards/{id}" },
  { id: "family_4", label: "POST /1/cards/{id}/idList", docsUrl: "https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/", guidance: "POST /1/cards/{id}/idList" },
  { id: "family_5", label: "GET/POST checklists", docsUrl: "https://developer.atlassian.com/cloud/trello/rest/api-group-cards/", guidance: "GET/POST checklists" },
  { id: "family_6", label: "webhooks endpoints", docsUrl: "https://developer.atlassian.com/cloud/trello/rest/api-group-cards/", guidance: "webhooks endpoints" },
];

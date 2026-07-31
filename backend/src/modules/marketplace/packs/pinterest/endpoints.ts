export const PINTEREST_ENDPOINT_FAMILIES = [
  { id: "oauth", label: "OAuth authentication and authorization", docsUrl: "https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/", guidance: "Request minimum scopes such as boards:read, pins:read, pins:write only as needed." },
  { id: "pins_boards", label: "Create boards and pins", docsUrl: "https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/", guidance: "Resolve board ids and media source before creating pins." },
  { id: "analytics", label: "Analytics API", docsUrl: "https://developers.pinterest.com/docs/api/v5/", guidance: "Read analytics only for authorized accounts and keep exports bounded." },
  { id: "webhooks", label: "Pinterest API webhooks where available", docsUrl: "https://developers.pinterest.com/docs/api/v5/", guidance: "Use official v5 surfaces and document gaps when events are unavailable." },
];

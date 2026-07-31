export const CODA_ENDPOINT_FAMILIES = [
  { id: "family_1", label: "GET /docs", docsUrl: "https://coda.io/developers/apis/v1", guidance: "GET /docs" },
  { id: "family_2", label: "GET /docs/{docId}/tables", docsUrl: "https://coda.io/developers/apis/v1#section/Authentication", guidance: "GET /docs/{docId}/tables" },
  { id: "family_3", label: "GET/POST /docs/{docId}/tables/{tableIdOrName}/rows", docsUrl: "https://coda.io/developers/apis/v1#operation/listDocs", guidance: "GET/POST /docs/{docId}/tables/{tableIdOrName}/rows" },
  { id: "family_4", label: "PUT /rows/{rowIdOrName}", docsUrl: "https://coda.io/developers/apis/v1#section/Rate-limits", guidance: "PUT /rows/{rowIdOrName}" },
  { id: "family_5", label: "GET /columns", docsUrl: "https://coda.io/developers/apis/v1#section/Errors", guidance: "GET /columns" },
  { id: "family_6", label: "GET /formulas", docsUrl: "https://coda.io/developers/apis/v1#tag/Webhooks", guidance: "GET /formulas" },
  { id: "family_7", label: "webhooks endpoints", docsUrl: "https://coda.io/developers/apis/v1#tag/Webhooks", guidance: "webhooks endpoints" },
];

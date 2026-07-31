export type WufooOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  pathParameters: readonly string[];
  bodyAllowed: boolean;
  mutating: boolean;
};

const operation = (
  id: string,
  method: WufooOperation["method"],
  path: string,
): WufooOperation => ({
  id,
  method,
  path,
  pathParameters: [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]),
  bodyAllowed: ["POST", "PUT"].includes(method),
  mutating: method !== "GET",
});

export const WUFOO_SOURCE_SHA256 =
  "c9581e01e3e65aaa641ad5118eca75e0a27d3e57a6c530b00732cf2d451c82ab";

// Pinned from Wufoo's official API v3 documentation on 2026-07-16. The
// partner-only login endpoint is deliberately excluded because it exchanges a
// customer's Wufoo password for an API key and requires a separately approved
// integration key; Relay accepts the user's existing API key instead.
export const WUFOO_OPERATIONS = [
  operation("forms.list", "GET", "/forms.json"),
  operation("forms.get", "GET", "/forms/{form_identifier}.json"),
  operation("forms.fields", "GET", "/forms/{form_identifier}/fields.json"),
  operation("forms.comments", "GET", "/forms/{form_identifier}/comments.json"),
  operation(
    "forms.commentsCount",
    "GET",
    "/forms/{form_identifier}/comments/count.json",
  ),
  operation("entries.list", "GET", "/forms/{form_identifier}/entries.json"),
  operation(
    "entries.count",
    "GET",
    "/forms/{form_identifier}/entries/count.json",
  ),
  operation("entries.create", "POST", "/forms/{form_identifier}/entries.json"),
  operation("reports.list", "GET", "/reports.json"),
  operation("reports.get", "GET", "/reports/{report_identifier}.json"),
  operation(
    "reports.entries",
    "GET",
    "/reports/{report_identifier}/entries.json",
  ),
  operation(
    "reports.entriesCount",
    "GET",
    "/reports/{report_identifier}/entries/count.json",
  ),
  operation(
    "reports.fields",
    "GET",
    "/reports/{report_identifier}/fields.json",
  ),
  operation(
    "reports.widgets",
    "GET",
    "/reports/{report_identifier}/widgets.json",
  ),
  operation("users.list", "GET", "/users.json"),
  operation("users.get", "GET", "/users/{user_hash}.json"),
  operation("webhooks.create", "PUT", "/forms/{form_identifier}/webhooks.json"),
  operation(
    "webhooks.delete",
    "DELETE",
    "/forms/{form_identifier}/webhooks/{webhook_hash}.json",
  ),
] as const;

export const WUFOO_OPERATION_BY_ID = new Map(
  WUFOO_OPERATIONS.map((item) => [item.id, item]),
);
export const WUFOO_READ_OPERATION_IDS = WUFOO_OPERATIONS.filter(
  (item) => !item.mutating,
).map((item) => item.id);
export const WUFOO_MANAGE_OPERATION_IDS = WUFOO_OPERATIONS.filter(
  (item) => item.mutating,
).map((item) => item.id);

export type JotformOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  pathParameters: readonly string[];
  bodyMode: "none" | "form" | "json";
  mutating: boolean;
};

const operation = (
  id: string,
  method: JotformOperation["method"],
  path: string,
  bodyMode: JotformOperation["bodyMode"] = method === "GET" ||
  method === "DELETE"
    ? "none"
    : "form",
): JotformOperation => ({
  id,
  method,
  path,
  pathParameters: [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]),
  bodyMode,
  mutating: method !== "GET",
});

export const JOTFORM_SOURCE_SHA256 =
  "ded079d796ecde08f097af8845a409d6afdd8af3f4ad6023f3827af01c51b0a3";

// Pinned from Jotform's official API v1 request-models.js on 2026-07-17.
// Deprecated folder routes, credential login/logout, public plan lookup, and
// arbitrary Enterprise custom origins are deliberately excluded.
export const JOTFORM_OPERATIONS = [
  operation("user.get", "GET", "/user"),
  operation("user.forms.list", "GET", "/user/forms"),
  operation("user.submissions.list", "GET", "/user/submissions"),
  operation("user.history.list", "GET", "/user/history"),
  operation("user.settings.get", "GET", "/user/settings"),
  operation("user.settings.update", "POST", "/user/settings"),
  operation("user.subusers.list", "GET", "/user/subusers"),
  operation("user.usage.get", "GET", "/user/usage"),
  operation("user.reports.list", "GET", "/user/reports"),
  operation("user.labels.list", "GET", "/user/labels"),
  operation("forms.create", "POST", "/form"),
  operation("forms.createMany", "PUT", "/form", "json"),
  operation("user.forms.create", "POST", "/user/forms"),
  operation("user.forms.createMany", "PUT", "/user/forms", "json"),
  operation("forms.get", "GET", "/form/{formId}"),
  operation("forms.delete", "DELETE", "/form/{formId}"),
  operation("forms.clone", "POST", "/form/{formId}/clone"),
  operation("forms.files.list", "GET", "/form/{formId}/files"),
  operation("forms.questions.list", "GET", "/form/{formId}/questions"),
  operation("forms.questions.create", "POST", "/form/{formId}/questions"),
  operation(
    "forms.questions.createMany",
    "PUT",
    "/form/{formId}/questions",
    "json",
  ),
  operation(
    "forms.questions.get",
    "GET",
    "/form/{formId}/question/{questionId}",
  ),
  operation(
    "forms.questions.upsert",
    "POST",
    "/form/{formId}/question/{questionId}",
  ),
  operation(
    "forms.questions.delete",
    "DELETE",
    "/form/{formId}/question/{questionId}",
  ),
  operation("forms.properties.list", "GET", "/form/{formId}/properties"),
  operation(
    "forms.properties.get",
    "GET",
    "/form/{formId}/properties/{propertyKey}",
  ),
  operation("forms.properties.update", "POST", "/form/{formId}/properties"),
  operation(
    "forms.properties.replace",
    "PUT",
    "/form/{formId}/properties",
    "json",
  ),
  operation("forms.reports.list", "GET", "/form/{formId}/reports"),
  operation("forms.reports.create", "POST", "/form/{formId}/reports"),
  operation("forms.submissions.list", "GET", "/form/{formId}/submissions"),
  operation("forms.submissions.create", "POST", "/form/{formId}/submissions"),
  operation(
    "forms.submissions.createMany",
    "PUT",
    "/form/{formId}/submissions",
    "json",
  ),
  operation("forms.webhooks.list", "GET", "/form/{formId}/webhooks"),
  operation("forms.webhooks.create", "POST", "/form/{formId}/webhooks"),
  operation(
    "forms.webhooks.delete",
    "DELETE",
    "/form/{formId}/webhooks/{webhookId}",
  ),
  operation("reports.get", "GET", "/report/{reportId}"),
  operation("reports.delete", "DELETE", "/report/{reportId}"),
  operation("submissions.get", "GET", "/submission/{submissionId}"),
  operation("submissions.update", "POST", "/submission/{submissionId}"),
  operation("submissions.delete", "DELETE", "/submission/{submissionId}"),
  operation("labels.get", "GET", "/label/{labelId}"),
  operation("labels.resources.list", "GET", "/label/{labelId}/resources"),
  operation("labels.create", "POST", "/label"),
  operation("labels.update", "PUT", "/label/{labelId}"),
  operation(
    "labels.resources.add",
    "PUT",
    "/label/{labelId}/add-resources",
    "json",
  ),
  operation(
    "labels.resources.remove",
    "PUT",
    "/label/{labelId}/remove-resources",
    "json",
  ),
  operation("labels.delete", "DELETE", "/label/{labelId}"),
] as const;

export const JOTFORM_OPERATION_BY_ID = new Map(
  JOTFORM_OPERATIONS.map((item) => [item.id, item]),
);
export const JOTFORM_READ_OPERATION_IDS = JOTFORM_OPERATIONS.filter(
  (item) => !item.mutating,
).map((item) => item.id);
export const JOTFORM_MANAGE_OPERATION_IDS = JOTFORM_OPERATIONS.filter(
  (item) => item.mutating,
).map((item) => item.id);

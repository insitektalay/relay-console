export type PaperformOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  pathParameters: readonly string[];
  bodyAllowed: boolean;
  mutating: boolean;
  tier: "standard" | "business";
};

const operation = (
  id: string,
  method: PaperformOperation["method"],
  path: string,
  tier: PaperformOperation["tier"] = "standard",
  mutating = method !== "GET",
): PaperformOperation => ({
  id,
  method,
  path,
  pathParameters: [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]),
  bodyAllowed: !["GET", "DELETE"].includes(method),
  mutating,
  tier,
});

export const PAPERFORM_SOURCE_SHA256 =
  "c205ebf92af505676d3f32b345e54496e448ef8aaf68390ed203bfdaaea9ffe0";

// Pinned from Paperform's official llms.txt endpoint index on 2026-07-16.
// Papersign is a separate product and is deliberately excluded here.
export const PAPERFORM_OPERATIONS = [
  operation("forms.list", "GET", "/forms"),
  operation("forms.get", "GET", "/forms/{slug_or_id}"),
  operation("forms.update", "PUT", "/forms/{slug_or_id}", "business"),
  operation("fields.list", "GET", "/forms/{slug_or_id}/fields"),
  operation("fields.get", "GET", "/forms/{slug_or_id}/fields/{field_key}"),
  operation("fields.update", "PUT", "/forms/{slug_or_id}/fields/{field_key}"),
  operation("submissions.list", "GET", "/forms/{slug_or_id}/submissions"),
  operation(
    "submissions.getForForm",
    "GET",
    "/forms/{slug_or_id}/submissions/{id}",
  ),
  operation(
    "submissions.deleteForForm",
    "DELETE",
    "/forms/{slug_or_id}/submissions/{id}",
  ),
  operation("submissions.get", "GET", "/submissions/{id}"),
  operation("submissions.delete", "DELETE", "/submissions/{id}"),
  operation(
    "partialSubmissions.list",
    "GET",
    "/forms/{slug_or_id}/partial-submissions",
  ),
  operation(
    "partialSubmissions.getForForm",
    "GET",
    "/forms/{slug_or_id}/partial-submissions/{id}",
  ),
  operation(
    "partialSubmissions.deleteForForm",
    "DELETE",
    "/forms/{slug_or_id}/partial-submissions/{id}",
  ),
  operation("partialSubmissions.get", "GET", "/partial-submissions/{id}"),
  operation("partialSubmissions.delete", "DELETE", "/partial-submissions/{id}"),
  operation("products.list", "GET", "/forms/{slug_or_id}/products"),
  operation(
    "products.create",
    "POST",
    "/forms/{slug_or_id}/products",
    "business",
  ),
  operation(
    "products.get",
    "GET",
    "/forms/{slug_or_id}/products/{product_sku}",
  ),
  operation(
    "products.update",
    "PUT",
    "/forms/{slug_or_id}/products/{product_sku}",
    "business",
  ),
  operation(
    "products.delete",
    "DELETE",
    "/forms/{slug_or_id}/products/{product_sku}",
    "business",
  ),
  operation(
    "products.updateQuantity",
    "PUT",
    "/forms/{slug_or_id}/products/{product_sku}/quantity",
  ),
  operation(
    "products.updateSold",
    "PUT",
    "/forms/{slug_or_id}/products/{product_sku}/sold",
  ),
  operation("coupons.list", "GET", "/forms/{slug_or_id}/coupons"),
  operation("coupons.create", "POST", "/forms/{slug_or_id}/coupons"),
  operation("coupons.get", "GET", "/forms/{slug_or_id}/coupons/{code}"),
  operation("coupons.update", "PUT", "/forms/{slug_or_id}/coupons/{code}"),
  operation("coupons.delete", "DELETE", "/forms/{slug_or_id}/coupons/{code}"),
  operation("webhooks.list", "GET", "/forms/{slug_or_id}/webhooks", "business"),
  operation(
    "webhooks.create",
    "POST",
    "/forms/{slug_or_id}/webhooks",
    "business",
  ),
  operation("webhooks.get", "GET", "/webhooks/{id}", "business"),
  operation("webhooks.update", "PUT", "/webhooks/{id}", "business"),
  operation("webhooks.delete", "DELETE", "/webhooks/{id}", "business"),
  operation("spaces.list", "GET", "/spaces", "business"),
  operation("spaces.create", "POST", "/spaces", "business"),
  operation("spaces.get", "GET", "/spaces/{id}", "business"),
  operation("spaces.update", "PUT", "/spaces/{id}", "business"),
  operation("spaces.listForms", "GET", "/spaces/{id}/forms", "business"),
  operation("translations.list", "GET", "/translations", "business"),
  operation("translations.create", "POST", "/translations", "business"),
  operation("translations.get", "GET", "/translations/{id}", "business"),
  operation("translations.update", "PUT", "/translations/{id}", "business"),
  operation("translations.delete", "DELETE", "/translations/{id}", "business"),
  operation("files.getUrls", "POST", "/files", "standard", false),
] as const;

export const PAPERFORM_OPERATION_BY_ID = new Map(
  PAPERFORM_OPERATIONS.map((item) => [item.id, item]),
);
export const PAPERFORM_READ_OPERATION_IDS = PAPERFORM_OPERATIONS.filter(
  (item) => !item.mutating,
).map((item) => item.id);
export const PAPERFORM_MANAGE_OPERATION_IDS = PAPERFORM_OPERATIONS.filter(
  (item) => item.mutating,
).map((item) => item.id);
export const PAPERFORM_STANDARD_OPERATION_IDS = PAPERFORM_OPERATIONS.filter(
  (item) => item.tier === "standard",
).map((item) => item.id);
export const PAPERFORM_BUSINESS_OPERATION_IDS = PAPERFORM_OPERATIONS.filter(
  (item) => item.tier === "business",
).map((item) => item.id);

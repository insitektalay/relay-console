export type FormstackOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  pathParameters: readonly string[];
  mutating: boolean;
};

const operation = (
  id: string,
  method: FormstackOperation["method"],
  path: string,
): FormstackOperation => ({
  id,
  method,
  path,
  pathParameters: [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]),
  mutating: method !== "GET",
});

export const FORMSTACK_SOURCE_SHA256 =
  "404840a48b55ff339958a0b8440c29d2c785b9bffc8174adc41a751b9f93f297";

// Pinned from Formstack's official V2025 OpenAPI registry on 2026-07-17.
// Undocumented Copilot onboarding internals and binary/multipart transfer
// routes are intentionally excluded from the Relay JSON tool surface.
export const FORMSTACK_OPERATIONS = [
  operation("getConfirmation", "GET", "/confirmations/{confirmationId}"),
  operation(
    "updateConfirmationEmail",
    "PUT",
    "/confirmations/{confirmationId}",
  ),
  operation(
    "deleteConfirmationEmail",
    "DELETE",
    "/confirmations/{confirmationId}",
  ),
  operation(
    "getFormConfirmationEmails",
    "GET",
    "/forms/{formId}/confirmations",
  ),
  operation("createConfirmationEmail", "POST", "/forms/{formId}/confirmations"),
  operation("getNotification", "GET", "/notifications/{notificationId}"),
  operation(
    "updateNotificationEmail",
    "PUT",
    "/notifications/{notificationId}",
  ),
  operation(
    "deleteNotificationEmail",
    "DELETE",
    "/notifications/{notificationId}",
  ),
  operation(
    "getFormNotificationEmails",
    "GET",
    "/forms/{formId}/notifications",
  ),
  operation("createNotificationEmail", "POST", "/forms/{formId}/notifications"),
  operation("getFieldDetails", "GET", "/forms/{formId}/fields/{fieldId}"),
  operation("editField", "PUT", "/forms/{formId}/fields/{fieldId}"),
  operation("deleteField", "DELETE", "/forms/{formId}/fields/{fieldId}"),
  operation("getFormFields", "GET", "/forms/{formId}/fields"),
  operation("createFieldInForm", "POST", "/forms/{formId}/fields"),
  operation("getFolder", "GET", "/folders/{folderId}"),
  operation("editFolder", "PUT", "/folders/{folderId}"),
  operation("deleteFolder", "DELETE", "/folders/{folderId}"),
  operation("listFolders", "GET", "/folders"),
  operation("createFolder", "POST", "/folders"),
  operation("getFormDetails", "GET", "/forms/{formId}"),
  operation("editForm", "PUT", "/forms/{formId}"),
  operation("deleteForm", "DELETE", "/forms/{formId}"),
  operation("getFormJavascript", "GET", "/forms/{formId}/javascript"),
  operation("getFormsList", "GET", "/forms"),
  operation("createForm", "POST", "/forms"),
  operation("copyForm", "POST", "/forms/{formId}/copy"),
  operation("createFormPrefill", "POST", "/forms/{formId}/prefill"),
  operation("getFormHtml", "GET", "/forms/{formId}/html"),
  operation(
    "createFormWebmergeIntegration",
    "POST",
    "/forms/{formId}/integrations/webmerge",
  ),
  operation(
    "getPartialSubmissionDetails",
    "GET",
    "/partialsubmission/{partialSubmissionId}",
  ),
  operation(
    "deletePartialSubmission",
    "DELETE",
    "/partialsubmission/{partialSubmissionId}",
  ),
  operation(
    "getPartialSubmissionsList",
    "GET",
    "/form/{formId}/partialsubmission",
  ),
  operation("createPortalAvatar", "POST", "/portal/{portalId}/avatar"),
  operation("deletePortalAvatar", "DELETE", "/portal/{portalId}/avatar"),
  operation("createPortalCopy", "POST", "/portal/{portalId}/copy"),
  operation("createPortalForm", "POST", "/portal/{portalId}/form"),
  operation("createPortalUser", "POST", "/portal/{portalId}/user"),
  operation("getPortal", "GET", "/portal/{portalId}"),
  operation("editPortal", "PUT", "/portal/{portalId}"),
  operation("deletePortal", "DELETE", "/portal/{portalId}"),
  operation("editPortalForm", "PUT", "/portal/{portalId}/form/{formId}"),
  operation("deletePortalForm", "DELETE", "/portal/{portalId}/form/{formId}"),
  operation("editPortalUser", "PUT", "/portal/{portalId}/user/{userId}"),
  operation("deletePortalUser", "DELETE", "/portal/{portalId}/user/{userId}"),
  operation("listPortals", "GET", "/portal"),
  operation(
    "createBulkSmartListOptions",
    "POST",
    "/smartlists/{smartListId}/bulkoptions",
  ),
  operation("listSmartLists", "GET", "/smartlists"),
  operation("createSmartList", "POST", "/smartlists"),
  operation("getSmartList", "GET", "/smartlists/{smartListId}"),
  operation("updateSmartList", "PUT", "/smartlists/{smartListId}"),
  operation("deleteSmartList", "DELETE", "/smartlists/{smartListId}"),
  operation("listSmartListOptions", "GET", "/smartlists/{smartListId}/options"),
  operation(
    "createSmartListOption",
    "POST",
    "/smartlists/{smartListId}/options",
  ),
  operation(
    "deleteAllSmartListOptions",
    "DELETE",
    "/smartlists/{smartListId}/alloptions",
  ),
  operation(
    "getSmartListOption",
    "GET",
    "/smartlists/{smartListId}/options/{optionId}",
  ),
  operation(
    "updateSmartListOption",
    "PUT",
    "/smartlists/{smartListId}/options/{optionId}",
  ),
  operation(
    "deleteSmartListOption",
    "DELETE",
    "/smartlists/{smartListId}/options/{optionId}",
  ),
  operation(
    "deleteSmartListOptionImage",
    "DELETE",
    "/smartlists/{smartListId}/options/{optionId}/image",
  ),
  operation(
    "subaccountCopyForm",
    "POST",
    "/subaccount/{subaccountId}/form/{formId}/copy",
  ),
  operation(
    "assignThemeToSubaccountForm",
    "PUT",
    "/subaccount/{subaccountId}/forms/{formId}/theme",
  ),
  operation("listSubaccounts", "GET", "/subaccount"),
  operation(
    "copyThemeToSubaccount",
    "POST",
    "/subaccount/{subaccountId}/theme/{themeId}/copy",
  ),
  operation(
    "deleteSubaccountTheme",
    "DELETE",
    "/subaccount/{subaccountId}/themes/{themeId}",
  ),
  operation(
    "getSubaccountThemeFormList",
    "GET",
    "/subaccount/{subaccountId}/themes/{themeId}/forms",
  ),
  operation("getSubaccountThemes", "GET", "/subaccount/{subaccountId}/themes"),
  operation(
    "createFileUploadUrls",
    "POST",
    "/forms/{formId}/fields/{fieldId}/upload-urls",
  ),
  operation("countFormSubmissions", "GET", "/forms/{formId}/submissions/count"),
  operation("getFormSubmissionsList", "GET", "/forms/{formId}/submissions"),
  operation("createSubmission", "POST", "/forms/{formId}/submissions"),
  operation("getSubmissionDetails", "GET", "/submissions/{submissionId}"),
  operation("editSubmission", "PUT", "/submissions/{submissionId}"),
  operation("deleteSubmission", "DELETE", "/submissions/{submissionId}"),
  operation("getSubmissionsList", "GET", "/submissions"),
  operation("listSubmitActions", "GET", "/forms/{formId}/submitactions"),
  operation("createSubmitAction", "POST", "/forms/{formId}/submitactions"),
  operation(
    "getSubmitAction",
    "GET",
    "/forms/{formId}/submitactions/{submitActionId}",
  ),
  operation(
    "updateSubmitAction",
    "PUT",
    "/forms/{formId}/submitactions/{submitActionId}",
  ),
  operation(
    "deleteSubmitAction",
    "DELETE",
    "/forms/{formId}/submitactions/{submitActionId}",
  ),
  operation("assignThemeToForm", "PUT", "/forms/{formId}/theme"),
  operation("copyTheme", "POST", "/themes/{themeId}/copy"),
  operation("deleteTheme", "DELETE", "/themes/{themeId}"),
  operation("getThemeFormList", "GET", "/themes/{themeId}/forms"),
  operation("getAccountThemes", "GET", "/themes"),
  operation("listWebhooks", "GET", "/forms/{formId}/webhooks"),
  operation("createWebhook", "POST", "/forms/{formId}/webhooks"),
  operation("getWebhook", "GET", "/forms/{formId}/webhooks/{webhookId}"),
  operation("updateWebhook", "PUT", "/forms/{formId}/webhooks/{webhookId}"),
  operation("deleteWebhook", "DELETE", "/forms/{formId}/webhooks/{webhookId}"),
  operation("getWebhookOpenApi", "GET", "/forms/{formId}/webhooks/openapi"),
] as const;

export const FORMSTACK_OPERATION_BY_ID = new Map(
  FORMSTACK_OPERATIONS.map((item) => [item.id, item]),
);
export const FORMSTACK_READ_OPERATION_IDS = FORMSTACK_OPERATIONS.filter(
  (item) => !item.mutating,
).map((item) => item.id);
export const FORMSTACK_MANAGE_OPERATION_IDS = FORMSTACK_OPERATIONS.filter(
  (item) => item.mutating,
).map((item) => item.id);

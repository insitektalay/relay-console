import type {
  BoundedRestConnector,
  BoundedRestOperation,
} from "../bounded-rest/bounded-rest-api.adapter";

type Method = BoundedRestOperation["method"];

const operation = (
  id: string,
  method: Method,
  path: string,
  pathParameters: readonly string[],
  description: string,
): BoundedRestOperation => ({
  id,
  method,
  path,
  pathParameters,
  mutating: method !== "GET",
  bodyAllowed: method === "POST" || method === "PUT" || method === "PATCH",
  description,
});

const standardResource = (plural: string, singular: string) => [
  operation(`list_${plural}`, "GET", `/${plural}`, [], `List ${plural}`),
  operation(
    `get_${singular}`,
    "GET",
    `/${plural}/{resource_id}`,
    ["resource_id"],
    `Get one ${singular}`,
  ),
  operation(
    `create_${singular}`,
    "POST",
    `/${plural}`,
    [],
    `Create one ${singular}`,
  ),
  operation(
    `update_${singular}`,
    "PUT",
    `/${plural}/{resource_id}`,
    ["resource_id"],
    `Update one ${singular}`,
  ),
];

const readOnlyResource = (plural: string, singular: string) => [
  operation(`list_${plural}`, "GET", `/${plural}`, [], `List ${plural}`),
  operation(
    `get_${singular}`,
    "GET",
    `/${plural}/{resource_id}`,
    ["resource_id"],
    `Get one ${singular}`,
  ),
];

/** Pinned from Action Network's official v2 documentation on 2026-07-18. */
export const ACTION_NETWORK_OPERATIONS: readonly BoundedRestOperation[] = [
  operation(
    "get_api_entry_point",
    "GET",
    "/",
    [],
    "Read the v2 API entry point",
  ),
  operation("get_metadata", "GET", "/metadata", [], "Read API metadata"),
  operation(
    "list_custom_fields",
    "GET",
    "/metadata/custom_fields",
    [],
    "List account custom fields",
  ),
  ...standardResource("advocacy_campaigns", "advocacy_campaign"),
  ...standardResource("event_campaigns", "event_campaign"),
  ...standardResource("events", "event"),
  ...standardResource("forms", "form"),
  ...standardResource("fundraising_pages", "fundraising_page"),
  ...standardResource("petitions", "petition"),
  ...standardResource("surveys", "survey"),
  ...standardResource("messages", "message"),
  ...standardResource("unique_id_lists", "unique_id_list"),
  ...readOnlyResource("campaigns", "campaign"),
  ...readOnlyResource("lists", "list"),
  ...readOnlyResource("queries", "query"),
  ...readOnlyResource("wrappers", "wrapper"),
  ...readOnlyResource("tags", "tag"),
  operation("create_tag", "POST", "/tags", [], "Create or deduplicate a tag"),
  operation(
    "list_list_items",
    "GET",
    "/lists/{list_id}/items",
    ["list_id"],
    "List items in one email or report list",
  ),
  operation(
    "get_list_item",
    "GET",
    "/lists/{list_id}/items/{item_id}",
    ["list_id", "item_id"],
    "Get one email or report list item",
  ),
  ...[
    "advocacy_campaigns",
    "event_campaigns",
    "events",
    "forms",
    "fundraising_pages",
    "petitions",
    "surveys",
  ].map((resource) =>
    operation(
      `get_${resource}_embed`,
      "GET",
      `/${resource}/{resource_id}/embed`,
      ["resource_id"],
      `Get ${resource} embed code`,
    ),
  ),
  operation("list_people", "GET", "/people", [], "List people"),
  operation(
    "get_person",
    "GET",
    "/people/{person_id}",
    ["person_id"],
    "Get one person",
  ),
  operation(
    "update_person",
    "PUT",
    "/people/{person_id}",
    ["person_id"],
    "Update one person",
  ),
  operation(
    "person_signup",
    "POST",
    "/people",
    [],
    "Create or subscribe a person through the signup helper",
  ),
  operation(
    "list_event_attendances",
    "GET",
    "/events/{event_id}/attendances",
    ["event_id"],
    "List event attendances",
  ),
  operation(
    "list_person_attendances",
    "GET",
    "/people/{person_id}/attendances",
    ["person_id"],
    "List person attendances",
  ),
  operation(
    "list_campaign_event_attendances",
    "GET",
    "/event_campaigns/{event_campaign_id}/events/{event_id}/attendances",
    ["event_campaign_id", "event_id"],
    "List event-campaign attendances",
  ),
  operation(
    "get_attendance",
    "GET",
    "/events/{event_id}/attendances/{attendance_id}",
    ["event_id", "attendance_id"],
    "Get one attendance",
  ),
  operation(
    "create_attendance",
    "POST",
    "/events/{event_id}/attendances",
    ["event_id"],
    "Create or record an attendance",
  ),
  operation(
    "create_campaign_event_attendance",
    "POST",
    "/event_campaigns/{event_campaign_id}/events/{event_id}/attendances",
    ["event_campaign_id", "event_id"],
    "Create or record an event-campaign attendance",
  ),
  operation(
    "update_attendance",
    "PUT",
    "/events/{event_id}/attendances/{attendance_id}",
    ["event_id", "attendance_id"],
    "Update one attendance",
  ),
  operation(
    "create_campaign_event",
    "POST",
    "/event_campaigns/{event_campaign_id}/events",
    ["event_campaign_id"],
    "Create an event inside an event campaign",
  ),
  operation("list_donations", "GET", "/donations", [], "List donations"),
  operation(
    "list_page_donations",
    "GET",
    "/fundraising_pages/{fundraising_page_id}/donations",
    ["fundraising_page_id"],
    "List fundraising-page donations",
  ),
  operation(
    "list_person_donations",
    "GET",
    "/people/{person_id}/donations",
    ["person_id"],
    "List person donations",
  ),
  operation(
    "get_donation",
    "GET",
    "/donations/{donation_id}",
    ["donation_id"],
    "Get one donation",
  ),
  operation(
    "create_donation",
    "POST",
    "/fundraising_pages/{fundraising_page_id}/donations",
    ["fundraising_page_id"],
    "Create or record a non-charging donation",
  ),
  ...[
    ["outreach", "outreaches", "advocacy_campaigns", "advocacy_campaign_id"],
    ["response", "responses", "surveys", "survey_id"],
    ["signature", "signatures", "petitions", "petition_id"],
    ["submission", "submissions", "forms", "form_id"],
  ].flatMap(([singular, plural, parent, parentId]) => [
    operation(
      `list_${parent}_${plural}`,
      "GET",
      `/${parent}/{${parentId}}/${plural}`,
      [parentId],
      `List ${plural} for one ${singular} action`,
    ),
    operation(
      `list_person_${plural}`,
      "GET",
      `/people/{person_id}/${plural}`,
      ["person_id"],
      `List a person's ${plural}`,
    ),
    operation(
      `get_${singular}`,
      "GET",
      `/${parent}/{${parentId}}/${plural}/{resource_id}`,
      [parentId, "resource_id"],
      `Get one ${singular}`,
    ),
    operation(
      `create_${singular}`,
      "POST",
      `/${parent}/{${parentId}}/${plural}`,
      [parentId],
      `Create or record one ${singular}`,
    ),
    operation(
      `update_${singular}`,
      "PUT",
      `/${parent}/{${parentId}}/${plural}/{resource_id}`,
      [parentId, "resource_id"],
      `Update one ${singular}`,
    ),
  ]),
  operation(
    "list_taggings",
    "GET",
    "/tags/{tag_id}/taggings",
    ["tag_id"],
    "List people tagged with one tag",
  ),
  operation(
    "get_tagging",
    "GET",
    "/tags/{tag_id}/taggings/{tagging_id}",
    ["tag_id", "tagging_id"],
    "Get one tagging",
  ),
  operation(
    "create_tagging",
    "POST",
    "/tags/{tag_id}/taggings",
    ["tag_id"],
    "Add one tag to a person",
  ),
  operation(
    "delete_tagging",
    "DELETE",
    "/tags/{tag_id}/taggings/{tagging_id}",
    ["tag_id", "tagging_id"],
    "Remove one tag from a person",
  ),
  operation(
    "send_message",
    "POST",
    "/messages/{message_id}/send",
    ["message_id"],
    "Send a mass email immediately",
  ),
  {
    ...operation(
      "stop_message_send",
      "DELETE",
      "/messages/{message_id}/send",
      ["message_id"],
      "Stop a mass email mid-send",
    ),
    bodyAllowed: true,
  },
  operation(
    "schedule_message",
    "POST",
    "/messages/{message_id}/schedule",
    ["message_id"],
    "Schedule a mass email",
  ),
  {
    ...operation(
      "cancel_message_schedule",
      "DELETE",
      "/messages/{message_id}/schedule",
      ["message_id"],
      "Cancel a scheduled mass email",
    ),
    bodyAllowed: true,
  },
];

export const ACTION_NETWORK_READ_OPERATION_IDS =
  ACTION_NETWORK_OPERATIONS.filter((item) => !item.mutating).map(
    (item) => item.id,
  );

export const ACTION_NETWORK_SYSTEM_READ_OPERATION_IDS = [
  "get_api_entry_point",
  "get_metadata",
  "list_custom_fields",
] as const;

export const ACTION_NETWORK_SENSITIVE_READ_OPERATION_IDS =
  ACTION_NETWORK_READ_OPERATION_IDS.filter(
    (id) => !ACTION_NETWORK_SYSTEM_READ_OPERATION_IDS.includes(id as never),
  );

export const ACTION_NETWORK_MANAGE_OPERATION_IDS =
  ACTION_NETWORK_OPERATIONS.filter((item) => item.mutating).map(
    (item) => item.id,
  );

export const ACTION_NETWORK_BOUNDED_REST_CONNECTOR: BoundedRestConnector = {
  slug: "action-network",
  name: "Action Network",
  baseUrl: "https://actionnetwork.org/api/v2/",
  credentialName: "ACTION_NETWORK_API_KEY",
  authorization: { headerName: "OSDI-API-Token", prefix: "" },
  operations: ACTION_NETWORK_OPERATIONS,
  health: { operationId: "get_api_entry_point" },
};

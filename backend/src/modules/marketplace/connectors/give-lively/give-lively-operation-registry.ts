import type {
  BoundedRestConnector,
  BoundedRestOperation,
} from "../bounded-rest/bounded-rest-api.adapter";

export const GIVE_LIVELY_OPERATIONS = [
  {
    id: "credentials_validate",
    method: "GET",
    path: "/nonprofits/{organizationId}/json_dataclips/validate/{apiKey}.json",
    pathParameters: [],
    mutating: false,
    bodyAllowed: false,
    description:
      "Validate the connected Give Lively Organization ID and API key.",
  },
  {
    id: "donations_index",
    method: "GET",
    path: "/nonprofits/{organizationId}/json_dataclips/{apiKey}.json",
    pathParameters: [],
    mutating: false,
    bodyAllowed: false,
    description:
      "Read donations created or updated since an optional Unix-epoch millisecond timestamp.",
  },
] as const satisfies readonly BoundedRestOperation[];

export const GIVE_LIVELY_BOUNDED_REST_CONNECTOR: BoundedRestConnector = {
  slug: "give-lively",
  name: "Give Lively",
  baseUrl: "https://secure.givelively.org/",
  pathCredentials: [
    {
      placeholder: "organizationId",
      credentialName: "GIVE_LIVELY_ORGANIZATION_ID",
    },
    { placeholder: "apiKey", credentialName: "GIVE_LIVELY_API_KEY" },
  ],
  operations: GIVE_LIVELY_OPERATIONS,
  health: { operationId: "credentials_validate" },
};

import { capability } from "../../catalog/marketplace-catalog.types";

export const INTERCOM_CAPABILITIES = [
  capability(
    "conversation_read",
    "Read conversation metadata",
    "Read only the total count and bounded privacy-redacted metadata for conversations in the exact connected workspace.",
    true,
  ),
];

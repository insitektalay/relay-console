export type TwilioSegmentEngageOperation = {
  id: string;
  path: string;
  policy: "structural_read" | "sensitive_read";
};

export const TWILIO_SEGMENT_ENGAGE_OPERATIONS: TwilioSegmentEngageOperation[] =
  [
    {
      id: "get_space",
      path: "/spaces/{spaceId}",
      policy: "structural_read",
    },
    {
      id: "list_audiences",
      path: "/spaces/{spaceId}/audiences",
      policy: "sensitive_read",
    },
    {
      id: "get_audience",
      path: "/spaces/{spaceId}/audiences/{audienceId}",
      policy: "sensitive_read",
    },
  ];

export const TWILIO_SEGMENT_ENGAGE_OPERATION_BY_ID = new Map(
  TWILIO_SEGMENT_ENGAGE_OPERATIONS.map((operation) => [
    operation.id,
    operation,
  ]),
);
export const TWILIO_SEGMENT_ENGAGE_STRUCTURAL_READ_OPERATION_IDS =
  TWILIO_SEGMENT_ENGAGE_OPERATIONS.filter(
    (operation) => operation.policy === "structural_read",
  ).map((operation) => operation.id);
export const TWILIO_SEGMENT_ENGAGE_SENSITIVE_READ_OPERATION_IDS =
  TWILIO_SEGMENT_ENGAGE_OPERATIONS.filter(
    (operation) => operation.policy === "sensitive_read",
  ).map((operation) => operation.id);

export type DribbbleOperation = {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  uploadField?: "image" | "file";
};

export const DRIBBBLE_OPERATIONS = [
  { id: "get-authenticated-user", method: "GET", path: "/user" },
  { id: "list-projects", method: "GET", path: "/user/projects" },
  { id: "list-shots", method: "GET", path: "/user/shots" },
  { id: "get-shot", method: "GET", path: "/shots/{shotId}" },
  { id: "create-shot", method: "POST", path: "/shots", uploadField: "image" },
  { id: "update-shot", method: "PUT", path: "/shots/{shotId}" },
  { id: "delete-shot", method: "DELETE", path: "/shots/{shotId}" },
  { id: "create-project", method: "POST", path: "/projects" },
  { id: "update-project", method: "PUT", path: "/projects/{projectId}" },
  { id: "delete-project", method: "DELETE", path: "/projects/{projectId}" },
  {
    id: "list-attachments",
    method: "GET",
    path: "/shots/{shotId}/attachments",
  },
  {
    id: "create-attachment",
    method: "POST",
    path: "/shots/{shotId}/attachments",
    uploadField: "file",
  },
  {
    id: "delete-attachment",
    method: "DELETE",
    path: "/shots/{shotId}/attachments/{attachmentId}",
  },
] as const satisfies readonly DribbbleOperation[];

export const DRIBBBLE_OPERATION_BY_ID = new Map<string, DribbbleOperation>(
  DRIBBBLE_OPERATIONS.map((operation) => [operation.id, operation]),
);

export const THREADS_ENDPOINT_FAMILIES = [
  { id: "threads_api", label: "Threads API overview", docsUrl: "https://developers.facebook.com/docs/threads/", guidance: "Use Threads-specific permissions and user tokens; do not reuse Instagram/Facebook tokens blindly." },
  { id: "publishing", label: "Threads publishing endpoints", docsUrl: "https://developers.facebook.com/docs/threads/posts/", guidance: "Create text/media containers and publish posts only after approval." },
  { id: "replies", label: "Replies and reply management", docsUrl: "https://developers.facebook.com/docs/threads/replies/", guidance: "Read and manage replies conservatively; hiding/showing replies is approval-required." },
  { id: "insights", label: "Threads insights", docsUrl: "https://developers.facebook.com/docs/threads/insights/", guidance: "Read post/account metrics for reporting without publishing side effects." },
];

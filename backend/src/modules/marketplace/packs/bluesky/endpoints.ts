export const BLUESKY_ENDPOINT_FAMILIES = [
  { id: "atproto", label: "AT Protocol HTTP APIs", docsUrl: "https://docs.bsky.app/docs/api/com-atproto-server-create-session", guidance: "Create sessions or use OAuth; never expose app passwords or refresh tokens." },
  { id: "create_record", label: "Repository records", docsUrl: "https://docs.bsky.app/docs/api/com-atproto-repo-create-record", guidance: "Create app.bsky.feed.post records only after approval." },
  { id: "post_tutorial", label: "Posting via the Bluesky API", docsUrl: "https://docs.bsky.app/blog/create-post", guidance: "Build posts with text facets, embeds, replies, and timestamps correctly." },
  { id: "feed", label: "Bluesky app feed APIs", docsUrl: "https://docs.bsky.app/docs/category/appbskyfeed", guidance: "Read timelines, author feeds, likes, reposts, and thread context with bounded queries." },
];

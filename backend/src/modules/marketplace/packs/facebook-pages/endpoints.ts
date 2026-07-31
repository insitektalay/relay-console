export const FACEBOOK_PAGES_ENDPOINT_FAMILIES = [
  {
    id: "oauth",
    label: "Relay-owned Meta OAuth",
    docsUrl: "https://developers.facebook.com/docs/facebook-login/",
    guidance:
      "Request exactly pages_show_list, pages_read_engagement, and pages_manage_posts through the Railway callback.",
  },
  {
    id: "selected_page",
    label: "Selected Page",
    docsUrl: "https://developers.facebook.com/docs/pages-api/getting-started/",
    guidance:
      "Enumerate eligible Pages during connection, verify required Page tasks, and immutably bind one Page id and Page token.",
  },
  {
    id: "own_posts",
    label: "Page-authored posts",
    docsUrl: "https://developers.facebook.com/docs/pages-api/posts/",
    guidance:
      "Read only the selected Page's /posts edge, one page, limit ten, with bounded fields.",
  },
  {
    id: "publish",
    label: "Plain-text Page publishing",
    docsUrl: "https://developers.facebook.com/docs/pages-api/posts/",
    guidance:
      "Create one plain-text post through the selected Page /feed endpoint with a body containing only message; never retry an ambiguous write.",
  },
];

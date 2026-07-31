export const YOUTUBE_DATA_API_ENDPOINT_FAMILIES = [
  {
    id: "videos",
    label: "Videos and Thumbnails",
    docsUrl: "https://developers.google.com/youtube/v3/getting-started",
    guidance: "Video updates, uploads, deletes, thumbnails and privacy/status changes require approval.",
    representativeEndpoints: ["GET /youtube/v3/videos","POST /upload/youtube/v3/videos","POST /youtube/v3/thumbnails/set"],
  },
  {
    id: "channels",
    label: "Channels and Subscriptions",
    docsUrl: "https://developers.google.com/youtube/v3/getting-started",
    guidance: "Channel owner data requires OAuth; ownership/admin changes are blocked.",
    representativeEndpoints: ["GET /youtube/v3/channels","GET /youtube/v3/subscriptions"],
  },
  {
    id: "playlists",
    label: "Playlists and Items",
    docsUrl: "https://developers.google.com/youtube/v3/getting-started",
    guidance: "Playlist writes affect public channel organization and require approval.",
    representativeEndpoints: ["GET /youtube/v3/playlists","GET /youtube/v3/playlistItems","POST /youtube/v3/playlistItems"],
  },
  {
    id: "comments",
    label: "Comments",
    docsUrl: "https://developers.google.com/youtube/v3/getting-started",
    guidance: "Replies and moderation can be public/customer-facing.",
    representativeEndpoints: ["GET /youtube/v3/commentThreads","POST /youtube/v3/commentThreads","PUT /youtube/v3/comments"],
  },
  {
    id: "captions_live",
    label: "Captions and Live",
    docsUrl: "https://developers.google.com/youtube/v3/getting-started",
    guidance: "Caption uploads/deletes and liveBroadcast/liveStream operations are high-impact.",
    representativeEndpoints: ["GET/POST/DELETE /youtube/v3/captions","GET/POST/PUT /youtube/v3/liveBroadcasts","GET/POST/PUT /youtube/v3/liveStreams"],
  },
  {
    id: "push",
    label: "Push Notifications",
    docsUrl: "https://developers.google.com/youtube/v3/getting-started",
    guidance: "Use PubSubHubbub instead of polling channel feeds.",
    representativeEndpoints: ["POST https://pubsubhubbub.appspot.com/ subscribe/unsubscribe"],
  },
];

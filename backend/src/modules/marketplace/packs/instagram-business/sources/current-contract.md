# Instagram Business current contract

Relay uses Business Login for Instagram with exactly `instagram_business_basic` for one bound Business or Creator professional account. No Facebook Page or Page access token is required.

The active surface is exactly three read-only actions: fixed-field account identity through `/me`, one page of at most ten recent owned-media summaries through `/me/media`, and one ownership-checked owned-media item. Publishing, comments, messages, insights, ads, discovery, people data, media bytes, pagination, and raw Graph access are blocked.

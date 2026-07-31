# GitHub Rate Limits

GitHub has both primary and secondary rate limits.

Operator rules:

- Treat rate limits as a workflow design concern, not just a retry concern.
- Cache repository metadata and avoid unnecessary polling.
- Avoid broad list endpoints when a targeted read will do.
- Back off immediately on secondary rate limit behavior.
- Do not loop on write operations.

Important GitHub-documented constraints to remember:

- most REST `GET`, `HEAD`, and `OPTIONS` requests cost fewer points than write requests;
- REST write requests such as `POST`, `PATCH`, `PUT`, and `DELETE` carry higher secondary-rate-limit point cost;
- excessive concurrency, repeated writes, and high content-creation volume can trigger secondary limits;
- content-generating requests should be treated carefully even if the primary limit remains available.

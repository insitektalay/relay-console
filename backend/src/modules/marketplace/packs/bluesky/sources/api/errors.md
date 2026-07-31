# Bluesky Errors And Failure Modes

Provider-specific failure modes:
- Missing permission/scope/product access or access-tier restriction.
- Native account mismatch or wrong target object.
- Rate limit/quota exceeded: Bluesky documents PDS overall API requests at 3,000 per 5 minutes per IP, createSession at 30 per 5 minutes and 300 per day per account, and content write-operation points per DID of 5,000 per hour and 35,000 per day where CREATE=3, UPDATE=2, DELETE=1. Blob upload max is 52,428,800 bytes at the PDS layer.
- Unsupported capability claim, invalid media, invalid visibility/privacy option, or moderation/admin permission failure.
- Policy/community-rule risk: Wrong DID/PDS, app-password exposure, public federation, quote/reply misreferences, label/moderation bypass, bulk follows/likes, deletion of the wrong record, and scraping/exporting private account data.

Stop and ask for clarification rather than falling back to another account or unsupported endpoint.

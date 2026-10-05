# API v1 to v2 migration

## MIGRATION X-Request-Trace TO Retry-Delay

No compatible rename exists. `Retry-Delay` is a response timing field and does not replace the request correlation header.

# API v1 headers

## HEADER X-Request-Trace

Request header carrying one opaque UTF-8 trace identifier. Clients generate it for request correlation. It contains no authorization material and must not be reused as a credential.

## HEADER X-Legacy-Trace

Request header carrying one opaque UTF-8 trace identifier for legacy request correlation. It is not an authorization credential.

# API v1 to v2 migration

## MIGRATION X-Request-Trace TO Trace-Context

For requests migrating from v1 to v2, rename `X-Request-Trace` to `Trace-Context`. The value remains a single opaque UTF-8 trace identifier with the same correlation-only and non-credential scope.

# Penetration test report

Target: `http://localhost:3123`. Run at 2026-10-14T16:29:33Z. **29 of 29 checks passed.**

| Category | Check | Result | Evidence |
|---|---|---|---|
| Control | Legitimate read-only query | Pass | HTTP 200: {"columns":["n"],"rows":[[40977]],"row_count":1,"truncated":false} |
| SQL injection | Drop a table | Pass | HTTP 400: {"error":"Only SELECT / WITH queries are allowed."} |
| SQL injection | Stacked statement after a valid query | Pass | HTTP 400: {"error":"Only a single statement is allowed."} |
| SQL injection | Mixed-case keyword to dodge filters | Pass | HTTP 400: {"error":"Only SELECT / WITH queries are allowed."} |
| SQL injection | Hidden statement after a comment | Pass | HTTP 400: {"error":"Only SELECT / WITH queries are allowed."} |
| SQL injection | Write a file with COPY | Pass | HTTP 400: {"error":"Only SELECT / WITH queries are allowed."} |
| SQL injection | Attach another database | Pass | HTTP 400: {"error":"Only SELECT / WITH queries are allowed."} |
| SQL injection | Re-enable file access | Pass | HTTP 400: {"error":"Only SELECT / WITH queries are allowed."} |
| SQL injection | Install an extension | Pass | HTTP 400: {"error":"Only SELECT / WITH queries are allowed."} |
| File access | Read an operating-system file | Pass | HTTP 403: {"error":"Access denied: queries can only read the project's processed tables, n |
| File access | Read raw data outside data/processed | Pass | HTTP 403: {"error":"Access denied: queries can only read the project's processed tables, n |
| File access | Read the API key file | Pass | HTTP 403: {"error":"Access denied: queries can only read the project's processed tables, n |
| File access | List files with glob() | Pass | HTTP 403: {"error":"Access denied: queries can only read the project's processed tables, n |
| File access | Escape with a relative path | Pass | HTTP 403: {"error":"Access denied: queries can only read the project's processed tables, n |
| Information disclosure | Errors hide server file paths | Pass | no server paths in error text |
| Path traversal | GET /../.env.local | Pass | HTTP 404, secrets leaked: False |
| Path traversal | GET /data/../../.env.local | Pass | HTTP 404, secrets leaked: False |
| Path traversal | GET /%2e%2e/%2e%2e/dashboard/.env.local | Pass | HTTP 404, secrets leaked: False |
| Path traversal | GET /.env.local | Pass | HTTP 404, secrets leaked: False |
| Input validation | Malformed JSON body | Pass | HTTP 400: {"error":"The request body must be JSON: { \"sql\": \"SELECT ...\" }"} |
| Input validation | 100 KB SQL request | Pass | HTTP 413: {"error":"Request too large. The limit is 16 KB."} |
| Input validation | 100 KB chat request | Pass | HTTP 413: {"error":"Request too large. The limit is 64 KB."} |
| Security headers | content-security-policy | Pass | default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:  |
| Security headers | x-frame-options | Pass | DENY |
| Security headers | x-content-type-options | Pass | nosniff |
| Security headers | referrer-policy | Pass | strict-origin-when-cross-origin |
| Security headers | permissions-policy | Pass | camera=(), microphone=(), geolocation=(), payment=(), usb=() |
| Security headers | No X-Powered-By header | Pass | not sent |
| Rate limiting | 40 queries in a few seconds | Pass | 13 allowed, 27 refused with HTTP 429 |

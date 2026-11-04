# Safety

- **Bind**: 127.0.0.1 unless `GWS_BIND` is set on purpose (Docker sets it inside the container; compose still publishes `127.0.0.1:` only, pinned by a test and a CI job).
- **Host check**: every request's Host must be loopback or on `LAB_ALLOWED_HOSTS` (validated host names). DNS-rebinding defence.
- **Same-origin writes**: every POST/PUT/PATCH/DELETE must be same-origin (Origin or Sec-Fetch-Site checked).
- **Ports**: 5750-5759 only; never the family-forbidden ports (5000, 8080, 5173, 3900, 4000, 4400, 4510, 4600-4601, 4840, 18080, 19080, 19090).
- **Netguard**: installed before anything else in `index.js`. Mock mode: loopback only, allowlist empty; a test asserts zero non-loopback attempts across a full chat + MCP cycle; the self-test blocks all eight escape routes (fetch, socket, socket-by-IP, dns lookup, dns resolve, udp send, udp connect, allowlisted-but-unconfigured). Real mode: the allowlist holds exactly the configured `CENTRAL_AGENT_A2A_URL` / `WORKER_TRACE_URL` hostnames; everything else is refused and recorded.
- **User text**: every chat message is scanned for non-reserved hosts and key-looking strings (`sk-…`, literal JWTs) and refused; control characters are stripped and input is length-capped. The exfil preset prompts carry only the well-known documentation example strings, and the doctor re-checks that the shipped text stays clean.
- **Secrets**: `CENTRAL_AGENT_A2A_BEARER` is write-only — read from the shared settings file, sent on the Real-mode request, never returned by any API, never logged, never echoed.
- **Rendered text**: agent answers go through marked + sanitize-html (no scripts, no event handlers, http/https/mailto links only). Everything else renders as text.
- **No identifiers from other projects**: only `.invalid`/`.example` hosts in shipped copy; the history scan must print 0; gitleaks pre-commit hook is installed by `npm install`.

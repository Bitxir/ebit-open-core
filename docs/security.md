# Security

- **Access control in the database.** Row-level security on every table; users only see their organisations' records.
- **Roles checked server-side** through a database function, never from editable profile data.
- **Private file storage.** Originals live in a private bucket; access is granted per request.
- **Server-side validation** with Zod on every server function.
- **Append-only history.** Provenance and audit logs cannot be altered.
- **No secrets in the browser.** Only the public client key ships to the browser; privileged keys stay on the server.
- **Sensitive locations** (e.g. threatened species) will be generalised for unauthorised viewers (Phase 4).

## Reporting a vulnerability

Please report security issues privately to the maintainers rather than opening a public issue. Include steps to reproduce and the affected version. We aim to acknowledge reports within 5 working days.

# Staging Validation Procedure

1. Provision isolated staging hosting and Supabase; record owners and region.
2. Configure server/browser variables from `.env.example`; use provider sandboxes and synthetic identities only.
3. Apply version-controlled migrations and safe BuildPro seed. Never run development sample-data scripts.
4. Run lint, typecheck, unit, integration, RLS, AI evaluation, browser E2E, build, secret scan, and dependency audit on the release commit.
5. Exercise quotation request confirmation/idempotency, employee assignment/status/history, private upload/download, handoff ownership/pause/resume, and verified customer-safe status.
6. Attempt cross-tenant IDs/tokens, reference enumeration, injection, duplicate webhook/message, invalid files, and expired/reused verification artifacts.
7. Verify mobile/keyboard/French entry, safe error recovery, security headers, rate-limit response/`Retry-After`, redacted trace-correlated logs, and AI usage/failure events.
8. Complete backup restore drill and rollback rehearsal. Attach dated evidence to the release record.

Staging validation is incomplete until the selected deployment platform, production verification provider, operational owners, retention, RPO, and RTO are supplied.

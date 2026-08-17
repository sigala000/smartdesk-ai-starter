# Pilot Operations Runbook

## Daily operation

The administrator checks authentication, request queue, handoff queue, failed attachments, status-verification failures, AI fallback/error/token trends, rate-limit spikes, and last backup. Use trace IDs to correlate events; do not ask customers for credentials or verification codes.

## Incident levels

- **Critical:** cross-tenant or credential exposure, destructive data loss. Disable affected entry points, rotate secrets, preserve evidence, and notify privacy/security owners immediately.
- **High:** request creation, login, storage, or handoff broadly unavailable. Prefer deterministic fallback, pause the rollout, and start rollback assessment.
- **Medium:** isolated workflow or provider degradation. Record trace IDs, communicate customer-safe status, and avoid false success claims.

## Rollback

Application rollback uses the last verified deployment. Database migrations are forward-fix by default: take a backup, assess data compatibility, and never run a destructive down migration automatically. If schema compatibility is uncertain, freeze writes and restore to a separate project following the restore runbook.

## Provider failures

OpenAI failure must retain deterministic chat behavior. Meta developer-test failure must not affect web chat. Storage failure must not create a ready attachment. Status provider failure returns a generic response without existence disclosure. Escalations never claim a human joined until backend acceptance.

## Handoff and closure

Record owner, impact, timeline, release/config changes, customer communication, recovery evidence, and follow-up actions. Reopen the pilot only after the acceptance checklist is re-run in proportion to impact.

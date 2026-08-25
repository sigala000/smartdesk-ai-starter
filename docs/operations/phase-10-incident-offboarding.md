# Phase 10 Incident, Offboarding, and Rollback Runbook

## Incident containment

Disable the affected connection first; use the global WhatsApp enable flag only
for a platform-wide emergency. Preserve provider IDs, trace IDs, delivery states,
and audit events without copying message bodies or credentials into tickets.
Revoke the Meta token in Meta Business Manager when compromise is suspected,
rotate the server encryption key through a reviewed re-encryption procedure, and
redeploy. Never retry a send whose provider acceptance is ambiguous.

## Organization offboarding

Suspend the subscription and channels, export only the authenticated tenant's
records through a reviewed administrative procedure, unsubscribe the WABA,
delete its credential envelope, and record revocation timestamps. Apply approved
retention and legal-hold rules before deleting customer or attachment data.
Database backups expire according to the retention policy and are not edited in
place.

## Rollback

Application rollback uses the previous reviewed Vercel deployment. Phase 10
migrations are forward-only; do not reverse them by dropping tenant data. Restore
from the pre-deployment checkpoint only for a declared disaster and follow
`backup-and-restore.md`. A rollback does not re-enable revoked Meta credentials.

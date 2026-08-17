# Backup and Restore Runbook

## Policy gates

The pilot owner must record the Supabase plan, backup frequency/retention, point-in-time recovery availability, RPO, and RTO before launch. Do not claim a backup exists until it is visible in the target project's backup page.

## Backup verification

1. In Supabase Dashboard, select the target project, open **Database → Backups**, and record the latest successful backup timestamp and type.
2. Export schema/version evidence with `supabase migration list --linked`; keep output in the private release record, not Git.
3. Never copy production customer data to development. Use sanitized fixtures for rehearsals.

## Staging restore drill

1. Create a separate, access-controlled recovery project.
2. Restore the selected backup using the provider-supported restore flow.
3. Apply no ad-hoc SQL. Compare migration history, run `npm run db:lint`, `npm run db:test`, and customer/employee smoke tests against the recovery environment.
4. Verify RLS, private storage, auth redirect allowlist, and row counts without exporting PII.
5. Record start/end time, achieved RPO/RTO, reviewer, failures, and deletion date for the recovery project.

## Incident restore

Freeze writes, declare the recovery point, notify the incident owner, restore to a replacement project, validate before DNS/config cutover, rotate credentials, and retain an audit timeline. Never overwrite the only recoverable project during diagnosis.

# Pilot Deployment Checklist

Every item needs an owner, date, environment, evidence link, and pass/fail result.

- [ ] Phase 9 quality/security commands pass on the release commit.
- [ ] Release commit is reviewed, immutable, and deployed to staging first.
- [ ] Separate staging/production Supabase and hosting projects exist.
- [ ] Production status provider is implemented; mock variables are absent.
- [ ] Production WhatsApp is disabled; Meta test credentials are absent from production.
- [ ] Secrets are stored server-side and rotation owners are named.
- [ ] Supabase Auth redirect URLs and site URL match the selected domains.
- [ ] Migrations are reviewed, backed up, applied, and migration history matches.
- [ ] RLS and cross-tenant negative tests pass against staging.
- [ ] Private attachment bucket and signed-download expiry are verified.
- [ ] Trusted client-IP header and rate limiting are verified through the real edge proxy.
- [ ] Full customer and employee journeys pass on mobile and desktop.
- [ ] Keyboard/screen-reader and English/French content review is signed off.
- [ ] Redacted logs, trace correlation, AI usage/failure alerts, uptime and error alerts work.
- [ ] Backup visibility and restore rehearsal meet approved RPO/RTO.
- [ ] Retention/privacy notice, pilot accounts, training, support rota, incident contacts, and rollback decision owner are approved.
- [ ] Known limitations are accepted by the pilot administrator.

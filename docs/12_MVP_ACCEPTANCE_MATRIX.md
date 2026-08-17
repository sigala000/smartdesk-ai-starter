# MVP Acceptance Matrix

This matrix is the release gate for the BuildPro pilot. “Automated” means the named repository command proves the behavior; “manual” requires dated evidence from the target environment.

| Journey or control | Evidence | Gate |
|---|---|---|
| Customer creates a confirmed request once | `npm run db:test`, public conversation route tests | Automated pass required |
| Employee login, tenant membership, request management | auth/request route tests and pgTAP RLS suite | Automated pass required |
| Attachments remain private and tenant scoped | attachment route tests and pgTAP | Automated pass required |
| Human handoff ownership and agent pause | handoff concurrency/route tests | Automated pass required |
| Verified status reveals customer-safe projection only | status route/concurrency tests | Automated pass required |
| Prompt injection and forbidden claims fall back safely | `npm run test:ai` | Automated pass required |
| WhatsApp developer-test adapter | `npm run test:whatsapp`; manual test-number evidence | Optional pilot channel; never production |
| Keyboard, WCAG smoke, mobile overflow | `npm run test:e2e` | Automated smoke plus manual screen-reader review |
| Secrets and dependencies | `npm run security:check` | No high-severity audit or credential finding |
| Cross-tenant isolation | pgTAP RLS tests and route negative tests | Automated pass required |
| Backup restore | `docs/operations/backup-and-restore.md` drill record | Staging drill required before pilot |
| Deployment/recovery | staging checklist and rollback rehearsal | Manual pass required |

## Open release gates

- Select and integrate a real production status-verification provider; production deliberately rejects the mock provider.
- Select staging and production hosting, database projects, domain, and operational owners.
- Approve retention periods, RPO/RTO, privacy contact, and incident escalation contacts.
- Perform a staging restore drill, accessibility review, and complete customer/employee journey rehearsal.

A successful build alone does not close these gates or establish production readiness.

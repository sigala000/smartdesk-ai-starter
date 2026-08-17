# Plan: Phase 9 Hardening and Pilot Preparation

## Goal

Turn the completed web MVP into a release-candidate that can be deployed to a
separate staging environment, exercised through repeatable customer and
employee journeys, operated safely during a limited BuildPro Cameroon pilot,
and rolled back or restored without improvisation.

Phase 9 is complete only when the documented MVP acceptance matrix has evidence,
no unresolved critical or high tenant-isolation issue remains, staging has
passed the release checklist, operational owners understand the pilot, and all
known limitations and launch gates are explicit. This phase does not add
production WhatsApp.

## User value

Customers receive a reliable, accessible, mobile-friendly web experience that
preserves their work through recoverable failures. Employees receive a tested
workflow and clear operational guidance. The pilot owner receives evidence for
security, privacy, cost, backup, restore, monitoring, support, and rollback
rather than relying on a successful local build alone.

## Current state

Repository inspection on 2026-08-11 found:

- The working tree contains completed Phase 5B, Phase 7, and Phase 8 changes
  that are not all committed. Phase 9 implementation must first preserve and
  establish a reviewed baseline; Git `HEAD` alone does not represent the
  current product.
- The application is a Next.js 16.3 strict-TypeScript modular monolith with
  Supabase PostgreSQL/Auth/private Storage, the server-only OpenAI Responses
  API, deterministic fallback, and a Meta developer-test transport.
- The web customer path supports conversation creation, deterministic and AI
  assistance, server-owned drafts, correction, confirmation, idempotent request
  creation, private attachments, human handoff, follow-up replies, and verified
  customer-safe status lookup.
- The employee path supports provisioned Auth users, fail-closed active
  membership resolution, request list/detail, assignment, a deliberately
  restricted status-transition subset, internal notes, request-information,
  attachment viewing, and handoff queue/ownership.
- Thirteen version-controlled pgTAP suites, real local Auth/route runners, three
  concurrency runners, 32 Vitest files, AI evaluations, WhatsApp tests, and a
  production build currently pass. CI runs application and database jobs.
- Database types are generated from the local migrated schema. Production-safe
  BuildPro seed data is separate from explicitly guarded development fixtures.
- Public abuse controls are database-backed fixed windows using HMAC subjects.
  They do not provide edge/WAF protection against distributed traffic.
- API errors contain a generated trace ID, but it is generally created only at
  response mapping and is not consistently propagated through services,
  provider calls, database events, and logs.
- Agent observations include organization, duration, tool names, fallback
  reason, and token counts, but currently go to `console.info`; there is no
  durable tenant usage ledger, alerting, budget threshold, or cost report.
- There is no browser automation dependency or `test:e2e` script. Existing
  end-to-end claims are HTTP/database harnesses plus manual browser checks.
- CSS contains useful responsive rules and focus states, but there is no
  automated accessibility audit, reduced-motion/zoom/high-contrast review, or
  device viewport matrix.
- The root document is fixed to `lang="en"`. Strings are embedded throughout
  components and services; no locale negotiation, message catalogue, French
  catalogue, or missing-translation test exists.
- There is no staging/production deployment definition, centralized
  environment matrix, health/readiness endpoint, backup/restore test procedure,
  privacy-retention configuration, retention cleanup job, support runbook, or
  pilot training guide.
- CI pins GitHub Actions by SHA and uses `npm ci`, but it has no automated
  dependency advisory gate, license/SBOM review, secret scan, or browser E2E
  job.
- The private attachment lifecycle has an explicit malware-scanning extension
  point, but pilot files are `not_scanned`; production configuration must not
  imply that antivirus scanning exists.
- Production status verification is deliberately unavailable until a real
  provider is selected. The development mock fails closed in production.
- Meta integration is limited to the developer test number, temporary/test
  configuration, and authorized test recipient. It must remain disabled in
  staging/production pilot environments unless a separately isolated developer
  test environment is being exercised.

### Documentation and acceptance reconciliation

The following differences must be resolved during Phase 9 and must not be
silently marked complete:

1. `README.md` still describes Phase 4 and an older environment/architecture
   state. It must be updated to the actual release candidate.
2. `docs/06_AGENT_BEHAVIOR.md` and `docs/07_API_CONTRACTS.md` still describe a
   verification token as model tool input. Phase 8 deliberately removed that
   credential from model context and uses a trusted conversation-bound
   server-side grant. The source documents must be corrected.
3. The product requirements include approved quotation upload and a complete
   employee processing outcome, while the current request service deliberately
   blocks evidence-dependent quotation/site-visit/execution transitions. The
   acceptance review must classify each missing capability as either a required
   pilot remediation or an explicitly approved MVP limitation. A required gap
   cannot be waived only by changing a test.
4. Product documents mention administrator management, feedback/closure, and
   broader journey steps that do not have complete UI workflows. The product
   owner must approve the precise pilot slice and limitations before launch.
5. `docs/07_API_CONTRACTS.md` says every response returns a trace ID, while
   successful responses generally do not. Phase 9 must either implement a
   consistent response-header/body contract or correct the documented rule.
6. `docs/05_DATABASE_SCHEMA.md` is a design document and differs in some names
   and fields from generated schema types. Phase 9 must document the migrations
   and generated types as implementation truth without rewriting historical
   intent.

These differences do not block creation of this plan. Items 3 and 4 are pilot
scope decisions and release gates; they may require focused remediation plans
if the owner confirms they are mandatory for the pilot.

## Scope

- Build a traceable acceptance matrix for every product and testing requirement.
- Add repeatable browser E2E coverage for the primary customer and employee
  journeys, including recovery paths and mobile viewports.
- Expand cross-tenant, public-access, prompt-injection, and secret-exposure
  regression coverage.
- Review runtime and development dependencies, advisories, provenance,
  licenses, unused packages, and lockfile reproducibility.
- Add automated repository/history/configuration secret scanning with an
  explicit false-positive review process.
- Review all public, authentication, upload, status, agent, and webhook rate
  limits and add deployment-edge controls appropriate to the chosen host.
- Standardize trace propagation, structured logging, redaction, and error
  recovery without storing full sensitive content by default.
- Add durable AI usage measurement and configurable cost protections.
- Complete accessibility and mobile-responsiveness remediation for pilot paths.
- Establish an English/French localization foundation and translate the pilot
  critical path after product review.
- Define privacy/retention defaults, cleanup ownership, legal approval points,
  and deletion exceptions for append-only audit requirements.
- Document and test database backup and restore, including Storage metadata and
  object recovery expectations.
- Define development, isolated Meta-test, staging, and production environment
  boundaries and fail-closed feature flags.
- Deploy and verify staging after the implementation and infrastructure target
  are approved.
- Provision the pilot administrator and employees without committing credentials.
- Create training notes, support/escalation procedures, rollback instructions,
  and the final pilot acceptance checklist.
- Correct source-document and README drift discovered by the acceptance review.

## Out of scope

- Production WhatsApp number onboarding, App Review, permanent Meta production
  credentials, message templates, marketing, media, billing, or production
  WhatsApp support.
- Multiple AI agents, voice, payments, accounting/CRM integrations, autonomous
  pricing, final quotation generation, contract approval, or engineering advice.
- A general workflow builder, analytics warehouse, full administrator console,
  or enterprise reporting product.
- Replacing Supabase, Next.js, or the modular-monolith architecture.
- Large features discovered during acceptance review without an explicit pilot
  scope decision. Create a focused remediation plan when a missing feature is
  too large or security-sensitive to treat as hardening.
- Claiming legal compliance certification, disaster-recovery guarantees, or
  malware protection that has not been independently validated.

## Dependencies and assumptions

- Phase 5B/7/8 changes are reviewed, committed, pushed, and reproducible from a
  clean checkout before Phase 9 implementation starts.
- The product owner approves the exact pilot capability matrix, including the
  disposition of quotation upload, evidence-dependent statuses, administrator
  management, feedback, and closure.
- A staging host and production host are selected before deployment-specific
  configuration is written. Do not assume Vercel or another provider solely
  from the Next.js framework.
- Separate Supabase projects exist for staging and production. Development and
  Meta developer-test traffic must not use the production database.
- The production status-verification provider is a launch dependency because
  the documented MVP requires verified status lookup. The owner must select a
  provider, approve its data processing/costs, and provide credentials through
  secret management. Until then, production status lookup remains disabled and
  pilot acceptance cannot mark FR-11 complete.
- Backup availability, point-in-time recovery, retention, and restore mechanics
  depend on the selected Supabase plan. Verify actual hosted capabilities rather
  than copying local assumptions.
- Privacy/retention defaults require owner and appropriate legal/privacy review;
  the implementation may enforce approved configuration but must not invent
  legal periods.
- Pilot administrator and employee identities are supplied out of band.
  Passwords, invitation links, recovery tokens, and service credentials never
  enter Git, tickets, screenshots, or this plan.
- Introducing a browser runner, accessibility engine, secret scanner, or
  observability SDK requires a dependency and data-boundary review. Prefer
  development-only tools and platform-native facilities where sufficient.
- French copy requires a fluent human reviewer. Machine-generated translation
  alone is not pilot acceptance evidence.
- All dates remain UTC in storage; display uses organization timezone and locale.

## Design

### 1. Acceptance-test review

Create a version-controlled matrix mapping every FR, NFR, AC-01 through AC-18,
roadmap exit criterion, security acceptance condition, and manual pilot item to:

- implementation location;
- automated unit/integration/E2E evidence;
- required manual evidence;
- environment where it was verified;
- owner;
- status: `pass`, `fail`, `blocked`, `not_applicable`, or `accepted_limitation`;
- issue/remediation link and approval when not `pass`.

No requirement may be marked passed from an unrelated lower-level test. Missing
core behavior becomes a release blocker or a separately approved, documented
pilot limitation consistent with the product requirements.

### 2. End-to-end customer journey

Add a real browser runner, proposed as Playwright after checking current Next.js
and Node 24 compatibility. Cover at minimum:

1. Open BuildPro web chat on desktop and a supported mobile viewport.
2. Confirm the assistant identifies itself as virtual.
3. Ask approved service information and verify grounded/fallback behavior.
4. Start a quotation request and collect one field at a time.
5. Correct a stored field and confirm the revised summary.
6. Upload valid JPEG/PNG/PDF files; reject oversize/spoofed/unsupported files.
7. Prove no request exists before confirmation.
8. Confirm once and retry; prove one request and one backend reference.
9. Request a human, observe queued wording, accept as employee, exchange
   messages, resolve, and explicitly resume automation.
10. Receive and answer a request-more-information question on the same request.
11. Complete status challenge/verification and see only the safe projection.
12. Exercise refresh, back navigation, duplicate click/message, slow response,
   provider outage, expired credential, and retry recovery.

Use isolated test data and deterministic provider doubles in CI. Staging smoke
tests use designated fictional pilot fixtures and must not expose production
secrets or real customer content in artifacts.

### 3. End-to-end employee journey

Automate and manually verify:

- provisioned employee login, refresh, logout, and expired session;
- active membership and deactivated-member denial;
- role-aware navigation plus direct-route server authorization;
- request search, filters, cursor pagination, empty/error states, and detail;
- same-tenant assignment and foreign/deactivated assignee rejection;
- valid status transition plus history/audit, and invalid jump denial;
- internal note creation with customer/model exclusion;
- private attachment access and authorization failure;
- request-information question, customer reply, and notification visibility;
- handoff queue, simultaneous acceptance, ownership, reply, resolution, and
  explicit automation resume;
- approved pilot quotation/status actions only after the scope decision and
  required evidence workflow are implemented.

### 4. Cross-tenant security campaign

Create two complete tenant fixtures with employees, customers, conversations,
requests, handoffs, attachments, knowledge, verification state, and provider
identifiers. Test every repository, API, RPC, signed URL, search/filter/cursor,
agent tool, and administrative operation in both directions.

Negative tests must include ID substitution, forged tenant fields, foreign
member/department assignment, conversation-cookie swapping, request/reference
swapping, status-token/grant swapping, attachment association/download,
knowledge retrieval, notification/handoff ownership, and WhatsApp test-account
destination substitution. Responses and timing must not reveal the foreign
record.

### 5. Prompt-injection regression campaign

Expand evaluation fixtures and mocked tool-loop tests for:

- prompt/system/tool-schema disclosure requests;
- attempts to access another tenant/customer/request;
- forged confirmation, reference, price, schedule, employee action, or tool
  success;
- injection inside customer messages, filenames, knowledge, and attachment
  text/metadata;
- multilingual English/French injection and obfuscated instructions;
- tool-call argument smuggling, oversized arguments, duplicate mutation calls,
  tool failure, provider outage, and loop exhaustion;
- internal-note, credential, personal-data, and prior-conversation leakage.

Evaluation assertions must test forbidden claims and tool execution, not only
keyword refusal. The deterministic path must remain usable when AI is disabled.

### 6. Dependency and supply-chain review

- Run clean `npm ci`, `npm audit`, `npm outdated`, dependency tree, and lockfile
  integrity checks using the repository npm version.
- Review every direct dependency's purpose, runtime exposure, maintenance,
  license, and pinned/resolved version. Remove unused packages only with tests.
- Generate a release SBOM using an approved tool or platform-native mechanism.
- Review transitive critical/high advisories; document accepted exceptions with
  owner, impact, mitigation, and expiry date.
- Keep CI Actions pinned to reviewed commit SHAs and review updates deliberately.
- Do not perform broad major-version upgrades in the same release unless needed
  for a security fix and separately tested.

### 7. Secret scanning

Add CI and release checks for:

- tracked files and full reachable Git history;
- `.env.example`, workflow files, documentation, fixtures, screenshots, and
  generated bundles;
- OpenAI, Supabase, Meta, Auth, webhook, signing, tunnel, and generic private-key
  patterns;
- browser assets for server-only variable names and recognizable secret values.

Use a scanner with pinned provenance and a reviewed allowlist containing no real
secret. A finding blocks release until removed and rotated. Record a rotation
procedure; do not print findings containing full credentials into public CI
logs.

### 8. Rate-limit and abuse review

Inventory limits for login/session refresh, conversation creation, messages,
AI turns, handoffs, status challenge/verification/read, attachment initiation
and bytes, employee mutations, and the developer-test webhook.

For each limit record subject, tenant scope, window, burst, response, retry
header, cleanup, monitoring, and trusted-client-IP source. Add:

- edge/WAF limits for unauthenticated high-volume endpoints on the chosen host;
- safe proxy-header configuration and tests;
- per-tenant and global AI budgets;
- upload/storage quotas;
- alert thresholds and an emergency feature-disable mechanism;
- distributed abuse and bypass tests where practical.

Database rate limiting remains defense in depth. Do not key on raw personal data
or trust arbitrary forwarding headers.

### 9. Error and recovery states

Review every page/API for loading, empty, validation, unauthorized, expired,
rate-limited, conflict, provider-down, timeout, partial-delivery, and retry
states. Preserve customer messages and server drafts before provider work.

Standardize safe retry guidance and idempotency. Never claim that a request,
message, notification, upload, handoff, or human action succeeded without a
confirmed backend/provider outcome. Add offline/slow-network browser tests and
ensure error boundaries offer a safe recovery route without losing confirmed
state.

### 10. Accessibility and mobile responsiveness

Establish WCAG 2.2 AA as the pilot target and test the critical pages with:

- automated accessibility checks in browser E2E;
- keyboard-only navigation, logical focus order, visible focus, and focus
  restoration after async operations;
- semantic headings, landmarks, form labels, descriptions, error association,
  live-region behavior, and no color-only meaning;
- contrast, 200% and 400% zoom/reflow, text spacing, reduced motion, and screen
  reader smoke checks;
- touch targets, virtual keyboard behavior, long content, and viewports from
  320 CSS pixels through desktop;
- Chrome/Chromium plus at least one Safari/WebKit-representative mobile check.

Accessibility failures on login, chat, confirmation, status, request detail,
or handoff controls block pilot acceptance.

### 11. English and French localization foundation

Create a small typed localization boundary rather than adding ad hoc conditionals:

- canonical locale codes `en` and `fr`;
- server-owned locale resolution from explicit supported preference, trusted
  organization default, and safe fallback;
- typed message catalogues with parity/missing-key tests;
- localized dates/numbers through `Intl` and organization timezone;
- locale-aware `<html lang>`, labels, validation/errors, status labels, agent
  deterministic prompts, and customer-safe notices;
- persisted locale on public conversations where needed, without translating
  canonical database status values;
- fluent human review of critical French customer and employee copy.

The foundation must not send French requests to a different tenant or weaken
prompt-injection/output validation. Unsupported locales fall back safely.

### 12. Logging, trace IDs, and redaction

Introduce one server-only structured logger and request trace context:

- accept a valid bounded upstream request ID only from a trusted platform, or
  generate a UUID;
- return the trace in a consistent response header and error shape;
- propagate it through route, service, repository/RPC audit event, OpenAI, Meta
  test adapter, verification provider, and storage operations;
- log event name, environment, organization ID, pseudonymous actor/conversation,
  duration, result code, provider/model/tool metadata, and trace ID;
- redact credentials, cookies, bearer tokens, OTPs, phone/email, query-string
  verify tokens, message/file content, prompts, tool arguments/results, and raw
  provider/database errors by default;
- add tests that feed known sentinel secrets and personal data through every log
  path and prove they are absent.

Logs must be access-controlled, retention-limited, and environment-separated.
Do not store chain-of-thought or full webhook bodies.

### 13. AI usage monitoring and cost protection

Record minimal durable AI usage per tenant/turn: trace, model, input/output
tokens, tool count, fallback/outcome, duration, and timestamps. Do not store raw
prompts or responses in the usage record.

Add configurable:

- per-turn input/output/tool/time limits;
- per-tenant hourly/daily usage and spend-equivalent ceilings;
- global emergency ceiling and AI kill switch;
- warning/critical alerts;
- retention and aggregation policy;
- deterministic fallback when a limit is reached.

Cost estimates use reviewed model pricing configuration and are operational
estimates, not billing truth. Unknown model pricing fails closed for cost-based
enablement or uses token-only caps until configured. Test concurrent budget
consumption transactionally.

### 14. Privacy and retention configuration

Obtain approval for configurable periods covering public access tokens,
abandoned drafts, messages/conversations, requests/history, attachments,
verification challenges/tokens/events, handoffs, notifications, provider
delivery metadata, AI usage, application logs, and audit records.

Implement dry-run-capable, tenant-aware cleanup jobs with legal/audit holds,
bounded batches, explicit environment guards, metrics, and tests. Deletion must
respect restrictive foreign keys and Storage objects; database metadata must not
claim a file was deleted when object deletion failed. Document data-subject and
employee-deactivation handling without promising unsupported automation.

### 15. Backups and restore

For staging and production:

- verify Supabase backup/PITR capabilities, schedule, encryption, access roles,
  retention, and alerting;
- define approved RPO and RTO;
- protect migration/link/deployment credentials;
- inventory database, Auth linkage, Storage objects, configuration, and secrets
  needed for recovery;
- document restore to an isolated project, never over live production as the
  first test;
- restore a backup, apply/verify migrations, regenerate types if appropriate,
  verify object/metadata consistency, run security smoke tests, and record
  timings/evidence;
- define how secrets are reissued and DNS/application traffic is switched.

At least one successful staging restore drill is required before pilot launch.

### 16. Environment separation and staging deployment

Maintain an explicit environment matrix:

| Environment | Data | Supabase | AI | Status provider | Meta WhatsApp |
| --- | --- | --- | --- | --- | --- |
| Local | fictional | local | mocked/optional | mock allowed | test only |
| Meta test | fictional authorized test | non-production | bounded | non-production | developer test only |
| Staging | fictional/synthetic | separate hosted | bounded real/mocked as approved | sandbox/approved | disabled |
| Production pilot | real pilot | separate hosted | bounded real | production provider required | disabled |

Validate required variables by environment and reject unsafe combinations,
including mock status in production, unscanned attachments when policy forbids
them, developer Meta credentials in staging/production, wildcard Auth redirects,
and local/production Supabase mismatches.

Deploy staging through the chosen provider's reviewed procedure. Run migrations
with a preview, backup, least-privilege operator, and post-deployment checks.
Verify HTTPS, security headers, cookie flags, Auth redirects/signup policy,
private Storage, RLS, health/readiness, logs/redaction, edge limits, OpenAI
budgeting, status delivery, and rollback before promoting the same artifact.

### 17. Production configuration checklist

The release checklist must cover:

- immutable commit/artifact identifier and clean CI;
- separate production Supabase URL/anon/service role configuration;
- Auth site URL, exact redirects, signup disabled, confirmed provisioned users,
  password/session policy, and deactivation test;
- OpenAI project/key/model, data settings, timeouts, usage budgets, and kill
  switch;
- selected status provider credentials, sender configuration, callbacks, abuse
  limits, and real-device test;
- strong independent HMAC/rate-limit secrets and trusted proxy header;
- private Storage bucket, size/MIME policy, unscanned-file decision, signed URL
  TTL, cleanup, and quotas;
- `META_WHATSAPP_ENABLED=false` and absence of test recipient/token/account
  mapping from production runtime;
- application base URL, HTTPS, secure cookies, headers, DNS, and health checks;
- migrations/seeds preview showing no development fixture;
- backup/PITR, restore evidence, retention jobs, log destinations/retention,
  alerts, support contacts, rollback owner, and incident communications;
- browser bundle and response scan for secrets/internal data;
- final cross-tenant and acceptance smoke tests.

### 18. Pilot administrator and employee setup

Create a least-privilege, auditable manual procedure to:

1. Provision the BuildPro pilot administrator in Supabase Auth.
2. Confirm email and password policy without sharing credentials.
3. Insert exactly one active BuildPro membership with the approved role and
   department.
4. Verify login, organization identity, role, and logout.
5. Provision named pilot employees with only necessary roles/departments.
6. Test a viewer/unauthorized account, employee deactivation, and removal of
   temporary setup access.
7. Record who approved access and when without recording passwords/tokens.

The service-role key is not used for routine employee activity.

### 19. Pilot employee training notes

Training must explain:

- signing in/out and protecting accounts;
- request queue, search, assignment, allowed statuses, and audit history;
- internal notes versus customer-visible messages;
- safe attachment handling and the current malware-scanning limitation;
- request-information and customer replies;
- handoff queue, when a human is actually active, ownership, resolution, and
  explicit automation resume;
- AI limitations: no invented price/date/service, confirmation requirement,
  escalation, and how to report a bad response;
- status privacy and why a reference alone reveals nothing;
- handling safety, fraud, payment disputes, complaints, unnecessary sensitive
  data, and suspected incidents;
- current pilot limitations and escalation/support contacts.

Use fictional practice records and require a short competency walkthrough.

### 20. Support, incident, and rollback runbook

Document severity, owner, communication, evidence preservation, and actions for:

- login/member lockout;
- AI/provider outage or cost ceiling;
- status delivery failure;
- upload/storage failure;
- database degradation or migration failure;
- cross-tenant/security suspicion;
- secret exposure;
- stuck handoff/outbound delivery;
- incorrect AI claim or unsafe content.

Rollback must prefer disabling feature flags/provider calls, routing traffic to
the prior immutable artifact, and forward/compensating database migrations.
Never delete migration history or run destructive rollback SQL without backup,
review, and explicit authority. Define stop-pilot criteria and customer/employee
communication templates.

## Database changes

Expected additive changes, subject to the implementation design review:

- AI usage/cost-control records with `organization_id`, bounded metadata,
  forced RLS, no public access, retention indexes, and atomic budget consumption.
- Optional operational event/retention-job records only if platform logs and
  scheduler evidence cannot satisfy audit needs.
- Cleanup functions/jobs for approved retention periods, designed in bounded
  batches and tested against restrictive foreign keys and Storage failures.
- Trace ID propagation into applicable audit/provider/security events when not
  already present.

Do not create a production WhatsApp migration. Do not amend already deployed
migrations; use reviewed forward migrations. Preview changes against staging,
take/verify a backup, use timeouts for production DDL, and provide compensating
or feature-disable rollback steps.

## Milestones

1. **Release baseline and acceptance inventory**
   - Commit/reproduce completed phases.
   - Correct documentation drift.
   - Build the acceptance matrix and decide pilot capability gaps.
   - Select staging host, status provider, retention defaults, RPO/RTO, and
     operational owners.

2. **Automated release and security gates**
   - Add browser E2E, accessibility, mobile, cross-tenant, injection, secret,
     dependency, and clean-checkout gates.
   - Review all rates and add edge/platform protections.
   - Prove no production WhatsApp configuration is enabled.

3. **UX, localization, observability, and cost hardening**
   - Add English/French catalogues and critical-path translations.
   - Remediate accessibility/mobile/recovery issues.
   - Add correlated structured logs, redaction, AI usage ledger, budgets,
     alerts, and kill switches.

4. **Privacy, operations, and staging**
   - Approve/configure retention and cleanup.
   - Document and perform backup/restore drill.
   - Deploy immutable staging artifact and run the full acceptance suite.
   - Resolve every critical/high issue and document accepted lower risks.

5. **Pilot readiness and handoff**
   - Complete production checklist without enabling production WhatsApp.
   - Provision/train pilot employees.
   - Exercise support, incident, rollback, and stop-pilot procedures.
   - Sign the pilot acceptance checklist.

## Expected file changes

Likely files to create:

```text
docs/plans/phase-9-hardening-and-pilot.md
docs/acceptance/mvp-acceptance-matrix.md
docs/operations/environment-matrix.md
docs/operations/staging-deployment.md
docs/operations/production-checklist.md
docs/operations/backup-and-restore.md
docs/operations/privacy-and-retention.md
docs/operations/support-and-rollback-runbook.md
docs/operations/pilot-administrator-setup.md
docs/operations/pilot-employee-training.md
docs/operations/pilot-acceptance-checklist.md
lib/i18n/locales.ts
lib/i18n/messages/en.ts
lib/i18n/messages/fr.ts
lib/observability/logger.ts
lib/observability/redaction.ts
lib/observability/trace-context.ts
lib/services/ai-usage-service.ts
lib/repositories/ai-usage-repository.ts
tests/e2e/customer-journey.spec.ts
tests/e2e/employee-journey.spec.ts
tests/e2e/accessibility-and-mobile.spec.ts
tests/e2e/recovery.spec.ts
tests/security/cross-tenant-release.test.ts
tests/security/log-redaction.test.ts
tests/security/secret-boundary.test.ts
tests/unit/i18n/catalogues.test.ts
tests/unit/observability/redaction.test.ts
scripts/retention-cleanup.mjs
scripts/verify-release-environment.mjs
scripts/verify-client-bundle-secrets.mjs
supabase/migrations/<timestamp>_phase_9_observability_retention.sql
supabase/tests/014_phase_9_operations_and_cost_controls.sql
playwright.config.ts
```

Likely files to modify:

```text
package.json
package-lock.json
.env.example
.github/workflows/ci.yml
README.md
PROJECT_TREE.txt
next.config.ts
app/layout.tsx
app/globals.css
app/**/page.tsx
app/**/loading.tsx
app/**/error.tsx
app/api/**/route.ts
components/**/*.tsx
lib/config/env-schema.ts
lib/config/env-server.ts
lib/http/api-response.ts
lib/agent/observability.ts
lib/agent/orchestrator.ts
lib/openai/responses-client.ts
lib/supabase/database.types.ts
tests/fixtures/agent-evaluations/phase-5.json
docs/00_INDEX.md
docs/04_ARCHITECTURE.md
docs/06_AGENT_BEHAVIOR.md
docs/07_API_CONTRACTS.md
docs/08_SECURITY_AND_PRIVACY.md
docs/09_TESTING_AND_ACCEPTANCE.md
docs/10_IMPLEMENTATION_ROADMAP.md
docs/11_DECISIONS.md
docs/plans/phase-9-hardening-and-pilot.md
```

Exact deployment files depend on the approved host. Do not add unused provider
configuration. Keep Phase 9 edits scoped; do not mechanically rewrite every
route if a shared boundary can propagate trace/localization behavior safely.

## Security review

- Preserve server-derived organization scope and RLS/composite tenant keys.
- Test service-role repositories explicitly because the key bypasses RLS.
- Keep all provider, signing, service-role, Auth, and OpenAI secrets server-side
  and environment-separated.
- Treat browser input, model output, knowledge, attachments, logs, traces, and
  restored data as untrusted.
- Keep internal notes, raw audit reasons, employee personal data, prompts, tool
  schemas/results, provider payloads, OTPs, and credentials out of customer
  responses and model context.
- Do not weaken confirmation, idempotency, reference generation, handoff
  ownership, attachment privacy, status verification, or append-only audit
  behavior to simplify E2E tests.
- Ensure log and test artifacts are private, redacted, and retained briefly.
- Secret findings require rotation as well as source removal.
- Staging uses synthetic data and separate credentials; production is never a
  test target for destructive, cross-tenant, load, or restore exercises.
- Production WhatsApp remains disabled and absent from pilot claims.

## Test plan

### Unit and component tests

- Locale resolution, catalogue parity, interpolation, date/number formatting,
  and missing-key fallback.
- Trace creation/validation/propagation and structured log redaction with
  sentinel secrets and personal data.
- AI usage calculation, unknown pricing, soft/hard budgets, concurrent limits,
  kill switch, and deterministic fallback.
- Environment matrix rejects every unsafe flag/credential combination.
- Rate-limit configuration and trusted proxy behavior.
- Recovery/error copy does not claim unconfirmed success.

### Database, RLS, and concurrency tests

- Existing 13 suites remain green from a clean reset.
- AI usage and operational tables have forced RLS, no public access, tenant
  foreign keys, bounded fields, and retention indexes.
- Tenant A cannot read/write B usage, trace, cleanup, or operational records.
- Concurrent AI-budget consumption cannot exceed a hard cap.
- Retention dry run changes nothing; approved execution deletes only eligible
  tenant data and preserves holds/audit requirements.
- Migration applies to empty and representative staging-sized databases without
  unsafe destructive behavior.

### Browser end-to-end tests

- Complete customer and employee journeys described above.
- Chromium desktop/mobile plus WebKit-representative critical smoke checks.
- Automated accessibility scan plus manual keyboard/screen-reader/zoom review.
- Slow/offline/provider failures, retry, duplicate clicks, expiration, and
  state-preservation cases.
- English and French critical path with correct document language and no
  canonical-state mutation.

### Security and AI evaluations

- Complete two-tenant attack matrix.
- Prompt injection and forbidden-claim dataset in both supported languages.
- Secret scan of tree, history, build, logs, test reports, and generated assets.
- Reference-only status denial, OTP brute-force/expiry/replay, token/grant
  binding, signed URL expiry, active handoff pause, and confirmation/idempotency
  regressions.
- Rate-limit bypass and distributed-load review on staging within approved safe
  limits.

### Operational verification

- Clean checkout/install/build and immutable artifact creation.
- Staging migration preview/apply and post-deployment smoke tests.
- Backup restore into an isolated staging recovery project with measured RPO/RTO.
- Alert and AI kill-switch drill.
- Previous-artifact rollback and migration-compensation tabletop/drill.
- Administrator provisioning, employee training walkthrough, and deactivation.

## Commands to run during implementation

Exact security/deployment tools must be selected and pinned during implementation.
Record actual commands and results.

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:ai
npm run test:whatsapp
npm run test:e2e
npm run test:accessibility
npm run test:security
npm run build
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
npm audit
npm outdated
git diff --check
```

Planned release wrappers should include equivalent scripts for secret scanning,
bundle scanning, retention dry run, environment verification, and the complete
release gate. Staging commands depend on the selected host and must include
migration preview, backup confirmation, deployment, smoke tests, and rollback
evidence without echoing secrets.

## Acceptance criteria

- [ ] Completed phases are committed and reproducible from a clean checkout.
- [ ] Every MVP requirement and AC-01 through AC-18 has linked evidence or an
      explicitly approved, product-consistent pilot limitation.
- [ ] The complete browser customer journey passes in English and reviewed
      French on desktop and mobile.
- [ ] The complete authorized employee pilot journey passes, including direct
      authorization negatives and deactivation.
- [ ] Two-tenant tests find no cross-tenant read, write, association, search,
      signed URL, tool, verification, provider, or timing leak.
- [ ] Prompt-injection and forbidden-claim evaluations pass in English and French.
- [ ] No request is created before confirmation or twice on retry; references
      remain database-generated.
- [ ] The assistant never claims a human/action/provider success without
      authoritative confirmation.
- [ ] Accessibility critical paths meet the documented WCAG 2.2 AA target and
      manual keyboard/screen-reader/zoom checks pass.
- [ ] Supported mobile viewports have no blocked controls, horizontal content
      loss, or unusable virtual-keyboard behavior.
- [ ] Trace IDs correlate requests, logs, providers, and audit/security events;
      redaction tests prove secrets and sensitive content are absent.
- [ ] AI usage is observable per tenant and hard global/tenant ceilings fail
      safely to deterministic behavior.
- [ ] Dependency, license/SBOM, lockfile, secret, repository-history, and client
      bundle reviews have no unresolved critical/high release issue.
- [ ] Rate limits are documented, tested, monitored, and reinforced at the edge
      for public expensive endpoints.
- [ ] Privacy/retention periods are approved, configured, tested in dry run, and
      assigned to an operational owner.
- [ ] A staging backup is successfully restored into isolation and recovery
      evidence records actual timing and integrity checks.
- [ ] Development, Meta test, staging, and production use separate projects,
      credentials, data, logs, and fail-closed feature configuration.
- [ ] Staging passes migrations, RLS/security smoke tests, browser acceptance,
      monitoring, alert, cost, recovery, and rollback checks.
- [ ] Production checklist explicitly confirms Meta WhatsApp is disabled and no
      developer-test credential/mapping is active.
- [ ] A production-grade status provider is selected/configured/tested, or the
      pilot is blocked because FR-11 cannot be satisfied safely.
- [ ] Pilot administrator/employees are provisioned with least privilege,
      trained using fictional records, and deactivation is verified.
- [ ] Support, security incident, rollback, stop-pilot, and communication
      procedures have named owners and have been exercised.
- [ ] Known limitations are visible to pilot stakeholders and do not contradict
      customer-facing claims.
- [ ] Formatting, lint, strict typecheck, all unit/integration/database/AI/
      WhatsApp-test/E2E/security suites, generated types, production build,
      secret scan, and final diff review pass.
- [ ] No production WhatsApp integration is added or enabled.

## Pilot acceptance checklist

- [ ] Product owner signs the capability/limitation matrix.
- [ ] Security owner signs tenant isolation, secret, attachment, Auth, status,
      prompt-injection, logging, and rate-limit evidence.
- [ ] Privacy owner signs collection, retention, deletion, logs, AI/provider data
      boundaries, and pilot notices.
- [ ] Operations owner signs staging, production configuration, backups, restore,
      alerts, support, incident, and rollback evidence.
- [ ] BuildPro pilot administrator confirms employee accounts, roles,
      departments, training, and escalation contacts.
- [ ] Customer quotation capture and employee receipt/process journeys pass on
      the release artifact.
- [ ] AI outage and cost-limit fallback preserve messages and request correctness.
- [ ] Status verification works through the approved production provider and
      reveals no internal data.
- [ ] Critical mobile/accessibility paths pass.
- [ ] There are no open critical/high issues; lower accepted risks have owner
      and review date.
- [ ] Rollback target and stop-pilot authority are confirmed before traffic.
- [ ] Production WhatsApp remains disabled.

## Progress log

- [x] Read `AGENTS.md`, `.agent/PLANS.md`, the documentation index, every
      repository specification, README, glossary/task guidance, and all
      completed Phase 0–8/5B execution plans.
- [x] Inspect the actual working tree, Git state, package scripts/dependencies,
      CI, environment schemas, Supabase configuration/migrations/tests, routes,
      UI states, agent/provider boundaries, logging, and test structure.
- [x] Identify documentation drift, missing pilot operations, and material
      release decisions without implementing workarounds.
- [x] Create this Phase 9 plan only.
- [x] Review and approve the Phase 9 plan and pilot capability matrix.
- [ ] Establish a committed clean release baseline after owner review.
- [x] Complete Milestone 1: release baseline and acceptance inventory.
- [x] Complete Milestone 2: automated local release and security gates.
- [x] Complete Milestone 3: UX, localization foundation, observability, and cost hardening.
- [ ] Complete Milestone 4: repository privacy/operations procedures are complete; hosted restore drill and staging validation await external environment decisions.
- [ ] Complete Milestone 5: repository checklist/training/runbooks are complete; named owners, training, and sign-off await pilot coordination.
- [ ] Record exact commands, staging evidence, deviations, remaining
      limitations, and final release artifact in completion notes.

## Decision log

- 2026-08-11: Plan only. No application, migration, dependency,
  infrastructure, environment, hosted project, or deployment was changed.
- 2026-08-11: Treat Phase 9 as an evidence-driven release phase. Existing local
  green checks are inputs, not sufficient pilot acceptance by themselves.
- 2026-08-11: Keep production WhatsApp outside the MVP. The Meta developer-test
  adapter stays isolated and disabled in staging/production pilot configuration.
- 2026-08-11: Propose Playwright for browser E2E/accessibility/mobile coverage,
  conditional on implementation-time compatibility and dependency review.
- 2026-08-11: Use typed application-owned English/French catalogues and `Intl`
  rather than a large localization platform until pilot needs justify one.
- 2026-08-11: Do not log full conversations to obtain observability. Correlate
  pseudonymous structured events and retain only the minimum required metadata.
- 2026-08-11: Production status verification is a release gate, not a reason to
  enable the development mock or weaken second-factor verification.
- 2026-08-11: Missing documented MVP capabilities require product disposition.
  Phase 9 may close bounded gaps, but large workflows receive focused plans and
  cannot be declared complete by narrowing acceptance tests.
- 2026-08-11: Backup existence is not restore evidence. Require an isolated
  staging restore drill before pilot launch.
- 2026-08-11: Retention periods, RPO/RTO, staging host, production status
  provider, and operational owners are explicit implementation dependencies
  requiring owner decisions.
- 2026-08-11: Installed Playwright and axe-core for repeatable Chromium desktop/mobile WCAG smoke tests; manual assistive-technology review remains a pilot gate.
- 2026-08-11: Added application-owned English/French catalogues and a French public-chat entry. Dynamic workflow prompts and all employee UI copy remain explicitly documented translation work rather than silently machine-translated text.
- 2026-08-11: Centralized structured logging redaction and AI usage/failure observations. Logs record opaque IDs, outcomes, latency, tool names, and token counts—not message or prompt bodies.
- 2026-08-11: Added repository secret scanning and high-severity npm audit gates. Production WhatsApp remains prohibited and untouched.
- 2026-08-11: Hosted staging, backup restore, production verification provider, retention values, operational owners, and pilot account actions cannot be safely created from repository code; keep those acceptance gates open.
- 2026-08-12: Extended the server-enforced request lifecycle through assessment, quotation decision, scheduling, delivery, client validation, completion, and closure. Status changes require role authorization, assignment/prerequisite evidence, history, and audit events.
- 2026-08-12: Quotation evidence is an explicitly approved, clean-scanned PDF attachment. Approval is tenant scoped, role restricted, and audited; browser fields cannot mark a quotation approved.
- 2026-08-12: Browser acceptance now runs a complete deterministic confirmed-request journey and dashboard-authentication boundary on desktop and mobile. The test server always uses disposable local Supabase credentials and cannot silently reuse a developer server.
- 2026-08-12: Secret scanning covers tracked and untracked non-ignored source plus generated browser/test artifacts, and detects privileged Supabase JWTs without treating publishable anon JWTs as secrets.

## Known risks and limitations

- The repository is currently dirty with completed Phase 5B/7/8 work. Phase 9
  should not begin implementation until that baseline is reviewed and committed.
- No production status provider is selected. This blocks a full production
  acceptance of the required status-lookup capability.
- Quotation evidence, later workflow transitions, administrator management,
  feedback, and closure are not all complete UI/application journeys. Pilot
  scope decisions may create focused remediation work before launch.
- Adding browser automation increases CI duration and introduces browser binary
  supply-chain/runner requirements.
- Automated accessibility tools find only part of accessibility defects;
  qualified manual review remains necessary.
- French translation quality and culturally appropriate wording require human
  review, especially safety, complaint, privacy, and status copy.
- Database-backed and edge rate limits cannot eliminate distributed abuse;
  monitoring and emergency controls remain necessary.
- Token-derived cost is an estimate and pricing can change. Hard token ceilings
  must remain effective independently of price calculations.
- The pilot attachment path has no real malware scanner unless one is selected
  and integrated. Unscanned files must be clearly governed and must not be
  represented as safe-scanned content.
- Supabase backup/restore and log capabilities vary by hosted plan. RPO/RTO must
  reflect verified capabilities, not desired values.
- Restrictive foreign keys and append-only audit/history complicate deletion.
  Retention cleanup needs carefully reviewed forward changes and restore tests.
- A staging deployment does not prove production safety if environments share
  projects, credentials, callbacks, or log destinations; separation is an
  acceptance requirement.
- Meta's developer-test integration uses temporary/test assets and does not
  validate production WhatsApp operations. It must not appear in pilot scope or
  customer promises.

## Completion notes

Implementation started on 2026-08-11 after approval. Local hardening adds safe
structured logging/redaction, trace IDs, security headers, English/French
catalogues, accessibility/mobile improvements, browser smoke tests, prompt-
injection regression coverage, secret/dependency gates, an acceptance matrix,
and pilot operations documentation. No database migration or production
WhatsApp integration was added. Hosted deployment, restore evidence, retention
values, a production status provider, named owners, account provisioning,
training, and sign-off remain external pilot gates and are not represented as
complete. Exact final command evidence is recorded in the implementation handoff.

Local verification completed on 2026-08-12: formatting, lint, strict typecheck,
155 Vitest tests, 32 AI tests/evaluations, production build, source/generated-
artifact secret scanning, npm high-severity audit, database lint, 246 pgTAP
schema/RLS tests, and every database-backed concurrency/route/E2E script
passed. A clean Supabase reset applied all migrations and production-safe seed
data. Eight Playwright checks passed the complete confirmed-request journey,
dashboard authentication boundary, accessibility smoke, and responsive layout
on desktop and mobile. Generated database types include the Phase 7/8 and
release-lifecycle migrations. Hosted staging, restore, scanner/provider setup,
and human sign-off evidence remain open as described above.

Dependency review found no audit vulnerabilities. Minor compatible updates are
available for axe-core and Supabase JS; major ESLint, Node type, and TypeScript
versions were intentionally not changed during final hardening because they need
separate compatibility review. The installed tree also reports optional Sharp
WASM packages as extraneous after Next.js build tooling; a clean `npm ci` is the
release source of truth.

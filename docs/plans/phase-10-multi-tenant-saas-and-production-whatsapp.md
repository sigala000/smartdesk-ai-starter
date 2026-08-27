# Plan: Phase 10 Multi-tenant SaaS and Production WhatsApp

## Goal

Turn the completed BuildPro pilot into a secure, self-service multi-tenant SaaS
foundation. Company owners can create an organization, configure its service
catalogue, invite employees, connect a client-owned WhatsApp Business account
through Meta Embedded Signup, and operate the existing SmartDesk conversation,
request, attachment, handoff, and status workflows without tenant or credential
leakage.

This plan includes all application-side work and testable provider boundaries.
Meta App Review submission, business verification, phone-number ownership,
payment-card entry, legal approval, and purchasing are explicit manual gates.

## User value

- A prospect can create a company workspace and evaluate SmartDesk without a
  developer editing database rows.
- Several authorized recipients can use Meta's developer test number during a
  controlled demonstration.
- A client can authorize its own Meta business assets without giving SmartDesk
  a password, OTP, or payment card.
- Each company owns its Meta billing relationship while SmartDesk records only
  connection and capability status.
- Existing confirmation, idempotency, audit, handoff, and AI fallback rules are
  identical across web and WhatsApp.

## Current state

- The Next.js modular monolith, Supabase Auth/PostgreSQL/Storage, RLS, employee
  dashboard, public web chat, deterministic request workflow, OpenAI
  orchestration, private attachments, human handoff, and verified status flow
  are implemented.
- `whatsapp_accounts` maps one trusted destination phone-number/WABA pair to an
  organization. Durable inbound/outbound delivery rows provide deduplication,
  leases, and safe retry states.
- The current runtime requires one global temporary Meta access token and one
  recipient. `MetaWhatsAppClient` rejects every other recipient. This is correct
  for Phase 5B but cannot support multiple tenants or production onboarding.
- Employee login assumes an already-provisioned Auth user and membership.
  `/dashboard/organization` is display-only.
- Existing product/roadmap/operations documents state that production WhatsApp
  is out of scope. Phase 10 intentionally supersedes that boundary and must
  update those documents without weakening the original security controls.
- The working tree contains a small WhatsApp destination-mismatch diagnostic
  and regression test. It is relevant to production diagnostics and will be
  preserved.

## Scope

### Milestone A: developer-test allowlist

- Replace the single test recipient with a normalized, bounded allowlist.
- Preserve a legacy single-recipient variable during migration.
- Enforce the allowlist only for `developer_test` accounts.
- Provide clear administrator documentation for Meta's authorized-recipient
  portal step.

### Milestone B: owner onboarding

- Public company-owner registration with email/password validation and generic
  error responses.
- Transaction-safe organization creation linked to the authenticated owner as
  the first active `admin` member.
- Default organization state `onboarding`; customer-facing channels remain
  inactive until required configuration is complete.
- Unique slug and reference-prefix allocation using database constraints and a
  server-owned retry strategy.
- Onboarding checklist and secure dashboard settings for organization details,
  services, departments, and employee invitations.

### Milestone C: production tenant and WhatsApp schema

- Organization lifecycle and onboarding completion fields.
- WhatsApp connection mode/state, display phone number, quality/health state,
  billing readiness, capability checks, last error, and audit timestamps.
- Encrypted credential envelope table separated from employee-visible account
  metadata.
- Developer-test recipient allowlist table.
- Embedded-signup state/code-exchange records with short expiry and one-time
  consumption.
- Subscription/trial and operational audit events.
- Composite same-tenant foreign keys, checks, indexes, forced RLS, restricted
  grants, and service-role-only credential access.

### Milestone D: Meta Embedded Signup

- Company-admin Connect WhatsApp UI using Meta's official SDK/configuration ID.
- Server-issued, authenticated, organization-bound, short-lived signup state.
- Server exchange of the authorization code; no token reaches browser storage.
- Fetch and validate WABA/phone assets from Meta, ensure they are not assigned to
  another tenant, subscribe the WABA to the existing webhook, store credentials
  encrypted, and run a capability test.
- Statuses: `not_connected`, `connecting`, `connected`, `action_required`,
  `disconnected`.
- Disconnect/reconnect and token-rotation-safe failure behavior.

### Milestone E: review and compliance readiness

- Public privacy, terms, and data-deletion instruction pages using explicitly
  marked owner-review placeholders rather than invented legal/company details.
- App Review runbook, permission justification, tester steps, screencast
  checklist, webhook field list, data-handling description, and evidence list.
- Do not submit to Meta or accept terms automatically.

### Milestone F: billing boundaries

- Record whether Meta billing/payment setup is ready based on trusted provider
  capability responses.
- Clearly state that Meta bills the client directly. Never accept, store, proxy,
  or log payment-card details and never attach SmartDesk to a line of credit.
- Block provider-dependent outbound operations when the provider reports a
  billing/capability problem while keeping web chat and existing data usable.

### Milestone G: SmartDesk trial/subscription foundation

- Provider-independent organization subscription state with configurable trial
  duration and feature entitlements.
- States `trialing`, `active`, `past_due`, `suspended`, and `cancelled`.
- Enforcement in server services; hidden UI is never the authorization boundary.
- No payment provider, checkout, invoice, or production price is invented.

### Milestone H: production WhatsApp operations

- Resolve organization/account from signed webhook destination assets.
- Load and decrypt that account's credential only inside server code.
- Preserve durable inbound-before-agent persistence, provider ID deduplication,
  leases, outbox idempotency, confirmation rules, handoff pause, trace IDs,
  redaction, and bounded rate limits.
- Developer-test accounts use allowlisted recipients; connected production
  accounts accept their own customers and use provider policy/capability state.
- Health/status visibility and retry/review queues for authorized admins.

### Milestone I: company administration

- Organization profile and onboarding checklist.
- Service/department management with active/inactive controls.
- Employee invitation/member deactivation and role management.
- WhatsApp connection, status, diagnostics, and reconnect/disconnect controls.
- Subscription/trial and usage summary without payment-card UI.
- Permission-aware routes and accessible responsive states.

### Milestone J: verification and release

- Unit, database/RLS, API integration, Meta mock, cross-tenant, concurrency,
  browser end-to-end, secret exposure, and regression tests.
- Update generated database types and all documentation that describes the
  product boundary.
- Run local migrations and the complete quality/security suite.
- Review/apply hosted Supabase migrations, configure required hosting variables
  without printing secret values, deploy to Vercel, verify smoke paths, then
  review/commit/push the intended release.

## Out of scope

- Automatic Meta business verification, App Review submission, or acceptance of
  Meta legal terms.
- Receiving or entering OTPs, business documents, passwords, or payment cards.
- SmartDesk-owned WhatsApp numbers, shared credit lines, BSP reseller billing,
  or Meta usage-price calculation.
- Selecting a payment provider or inventing SmartDesk production prices.
- Migrating an existing production phone number without an owner-approved
  migration window and rollback plan.
- Automated final quotations, autonomous pricing, online payments, voice calls,
  accounting integration, or multiple AI agents.

## Dependencies and assumptions

- Supabase Auth email/password remains the owner identity provider.
- A client can have one active WhatsApp phone connection initially; constraints
  and code remain compatible with more accounts later.
- Meta App ID and Embedded Signup configuration ID are browser-safe identifiers.
  App secret, system-user/access tokens, and credential encryption key are
  server-only secrets.
- Credential storage uses AES-256-GCM envelope encryption with a versioned
  server-held 32-byte key. Ciphertext, IV, and authentication tag are stored in
  a service-role-only table. Key rotation is versioned and documented.
- Provider Graph API shapes and permissions are isolated behind an adapter and
  revalidated against official Meta documentation before production approval.
- Trial duration is configuration, not pricing. Subscription enforcement must
  not corrupt or delete tenant data.

## Architecture and data flow

1. Owner registers through Supabase Auth and confirms email according to the
   environment's Auth policy.
2. An authenticated server route calls a security-definer transaction that
   creates one `onboarding` organization and the caller's `admin` membership.
3. Admin configures company profile, departments/services, and employees.
4. Admin starts Embedded Signup. Server creates an expiring state digest bound
   to member, organization, origin, and one attempt.
5. Browser receives only state and public Meta IDs. Meta returns a short-lived
   code; browser sends code plus state to the server once.
6. Server consumes state, exchanges the code, fetches WABA/phone assets,
   validates uniqueness/ownership, subscribes the WABA, encrypts the resulting
   credential, and marks connection status.
7. Meta signs webhook raw bytes with the app secret. The destination phone/WABA
   resolves a single active account and tenant before any customer processing.
8. The account credential is decrypted only for an outbound provider request.
   Existing conversation/application services remain authoritative.

## Security design

- Organization scope comes from Auth membership or signed provider destination,
  never form JSON, Meta customer content, model output, or query parameters.
- Onboarding mutation APIs require active `admin`/`manager` permissions; owner
  creation itself requires an authenticated user with no conflicting active
  membership and a database transaction.
- Credentials have no `anon` or `authenticated` table grants/policies. APIs
  return only status metadata and redacted phone display.
- Embedded state is random, digest-only at rest, expiring, one-time, origin
  bound, and invalidated on use/failure.
- Provider tokens, app secret, encryption keys, Supabase service role, OpenAI
  key, cookies, raw webhook bodies, message bodies, and full phone numbers are
  excluded from logs and browser output.
- Webhook signature verification precedes parsing and database access. Payload
  size/schema limits remain enforced.
- Every new tenant-owned table has immutable `organization_id`, composite
  foreign keys where associations are tenant-owned, forced RLS, explicit grants,
  and cross-tenant negative tests.
- Subscription checks fail closed for new paid-channel activity but do not erase
  or hide data needed by an authorized tenant to resolve billing/action state.
- Request creation still requires server-stored confirmed fields and the
  existing idempotent database transaction.

## Database migration order

1. Add organization lifecycle and subscription/trial fields with safe defaults
   that preserve the existing BuildPro tenant.
2. Extend `whatsapp_accounts` with mode/status/health/capability metadata.
3. Add credential envelopes, developer-test recipients, embedded-signup
   attempts, invitations, and tenant audit/usage support tables.
4. Add constraints, same-tenant composite foreign keys, indexes, immutable
   triggers, grants, forced RLS, and policies.
5. Add narrowly scoped security-definer functions for owner organization
   creation and other atomic operations; revoke public execution first.
6. Backfill BuildPro as active and its existing Meta account as
   `developer_test`; seed no production credentials.
7. Regenerate TypeScript database types.

All changes are additive/forward-safe. No existing tenant row or request data is
deleted. Rollback is a forward fix; credential columns/tables are not dropped
while encrypted material exists.

## Expected files

Create or update:

- `docs/plans/phase-10-multi-tenant-saas-and-production-whatsapp.md`
- `supabase/migrations/*phase_10*.sql`, `supabase/tests/*phase_10*.sql`
- `lib/supabase/database.types.ts`
- `lib/config/*`, `.env.example`
- `lib/crypto/*`, `lib/meta/*`, `lib/repositories/*`, `lib/services/*`
- `lib/auth/permissions.ts`, onboarding/admin schemas and DTOs
- `app/(auth)/register/*`, `app/onboarding/*`
- `app/dashboard/organization/*`, `app/dashboard/whatsapp/*`, admin APIs
- `app/api/meta/whatsapp/*`, existing webhook route/runtime
- public privacy/terms/data-deletion pages
- unit/integration/E2E/Meta mock tests and package scripts when required
- product, journey, architecture, schema, API, security, testing, roadmap,
  decision, limitations, deployment, and operations documentation

## Test strategy

- Environment parsing and production fail-closed configuration.
- Encryption round-trip, tamper failure, key/version mismatch, and no plaintext
  snapshots/logs.
- Owner signup/onboarding validation, duplicate slug/prefix, multiple-membership
  denial, deactivated organization, role denial, and transaction rollback.
- RLS: anonymous/authenticated credential denial; A cannot read/write B across
  organizations, settings, members, services, invitations, accounts,
  credentials, signup attempts, subscriptions, or operational events.
- Embedded Signup: state expiry/replay/origin/member/tenant mismatch, malformed
  code, Meta auth/fetch/subscribe/capability failure, asset collision, success,
  reconnect, and disconnect.
- Developer-test multiple-recipient allowlist and production-account behavior.
- Signed spoof rejection, provider delivery dedupe, simultaneous webhook claim,
  outbound retry ambiguity, account-specific token selection, token rotation,
  tenant resolution, and redacted logs.
- Existing web/WhatsApp confirmation, request reference, handoff pause, tool
  authorization, AI fallback, attachment privacy, and status privacy regression.
- Responsive keyboard-accessible onboarding/admin UI, loading/empty/error/action
  required states, and complete owner-to-request E2E with provider mocks.

## Commands

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:ai
npm run test:whatsapp
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types:check
npm run test:e2e
npm run security:check
npm run build
supabase migration list --linked
supabase db push --linked --dry-run
supabase db push --linked
vercel deploy --prod
git diff --check
git status --short
```

Hosted commands run only after local verification. Secret values are never
printed. Meta portal/App Review/legal/payment actions remain manual.

## Acceptance criteria

- [x] Multiple explicitly authorized developer-test recipients work without
  weakening the allowlist or accepting arbitrary numbers.
- [x] A new owner can register, create exactly one isolated onboarding tenant,
  configure its organization, and reach a clear activation checklist.
- [x] Company A cannot read, mutate, connect, send for, or diagnose company B.
- [x] Administrator authorization is enforced server-side for sensitive management
  action; deactivated members and organizations fail on the next request.
- [x] Meta Embedded Signup state is expiring/one-time/tenant-bound and the
  browser never receives a provider access token or app secret.
- [x] Provider credentials are encrypted at rest, authenticated on decrypt,
  server-only, rotatable, and absent from logs/client bundles/tests/Git.
- [x] Signed production webhooks resolve a single tenant from destination assets,
  deduplicate provider messages, persist inbound messages before agent work, and
  send through that tenant's credential.
- [x] WhatsApp and web share the same agent and application services; confirmed
  request creation and backend references remain idempotent and authoritative.
- [x] Developer-test and production modes cannot be confused; test credentials
  and sample recipients are not seeded into production tenants.
- [x] Meta bills clients directly; SmartDesk stores no payment instrument and
  uses no shared line of credit.
- [x] Subscription/trial states and feature entitlements are provider-independent,
  enforced on the server, and do not invent prices or a payment provider.
- [x] Privacy, terms, and deletion pages visibly require owner/legal approval
  where real details are unavailable; no fabricated legal claim appears.
- [x] Meta review/runbook documentation identifies every manual portal action and
  no submission/term acceptance/OTP/payment action is automated.
- [x] Full local quality, database, RLS, security, AI, WhatsApp, E2E, and build
  checks pass; hosted migration/deployment smoke checks are recorded separately.
- [x] Documentation accurately supersedes the former production-WhatsApp
  non-goal and lists remaining external/manual gates.

## Progress log

- [x] 2026-08-27 follow-up: corrected the production Content Security Policy
  to allow only the Facebook SDK, Graph, image, and frame origins required by
  Embedded Signup. Added regression coverage and replaced the internal
  `meta_sdk_unavailable` code with a customer-safe retry message.
- [x] 2026-08-27 follow-up: replaced silent organization-management action
  failures with explicit validation/database outcomes, pending button states,
  and accessible success/error feedback; rejected self-invitations and revoke
  undeliverable invitation records. The WhatsApp page now distinguishes a
  missing operator-owned Meta Configuration ID from a broken company account
  instead of rendering an action that is known to fail.
- [x] 2026-08-27 follow-up: corrected post-login routing so a verified owner
  with no membership retains the server-validated session and reaches tenant
  onboarding; dashboard access still requires one active membership, other
  access failures still clear the session, and invitation return paths remain
  narrowly allowlisted.

- [x] Read the attached Phase 10 authorization and repository instructions.
- [x] Inspect the documentation inventory, completed plans, Git baseline,
  package scripts, environment validation, application structure, Supabase
  migrations, and existing Phase 5B WhatsApp boundaries.
- [x] Identify the deliberate single-tenant/test-recipient limitation and the
  documentation scope contradiction.
- [x] Create this living Phase 10 execution plan before implementation.
- [x] Milestone A: multiple developer-test recipients.
- [x] Milestone B: owner registration and organization onboarding.
- [x] Milestone C: production schema, RLS, and encrypted credentials.
- [x] Milestone D: Embedded Signup and account connection lifecycle.
- [x] Milestone E: compliance/review readiness.
- [x] Milestone F: Meta client-direct billing boundary.
- [x] Milestone G: trial/subscription foundation.
- [x] Milestone H: production WhatsApp operations foundation.
- [x] Milestone I: company administration UI.
- [x] Milestone J: automated/local/hosted verification, documentation, release,
  deployment, commit, and push.

## Decision log

- 2026-08-27: `membership_required` has two legitimate pre-dashboard uses:
  first-owner onboarding and invitation acceptance. It may retain the verified
  session only for those allowlisted routes; it never authorizes dashboard or
  tenant data access. The database remains authoritative and refuses owner
  creation when any membership already exists.

- 2026-08-25: Phase 10 explicitly supersedes the earlier MVP decision that
  production WhatsApp was out of scope. It does not supersede confirmation,
  tenant isolation, server-secret, deterministic fallback, or single-agent
  rules.
- 2026-08-25: Use one Meta app/webhook with destination phone/WABA mapping to a
  tenant. Do not create a separate agent or deployment per company.
- 2026-08-25: Store provider credentials with application-layer AES-256-GCM
  envelope encryption and a server secret so no new external secret provider is
  required to complete the application-side implementation.
- 2026-08-25: Client companies own Meta business assets and Meta billing.
  SmartDesk will not supply a shared credit line or collect payment cards.
- 2026-08-25: Subscription/trial state is provider-independent. Phase 10 adds
  enforcement and display foundations, not checkout or invented pricing.
- 2026-08-25: Existing BuildPro remains active and its current Meta connection is
  classified as `developer_test` during migration to avoid service disruption.
- 2026-08-25: Only administrators receive organization, employee, and WhatsApp
  management permissions. Managers retain operational request, catalogue, and
  handoff permissions; hiding navigation is never an authorization control.
- 2026-08-25: A production connection remains `test_pending` after Embedded
  Signup. A trusted inbound webhook and successfully persisted provider reply
  are both required before the repository promotes it to `active`.
- 2026-08-25: Customer opt-out identifiers are stored as tenant/account-bound
  SHA-256 digests. No marketing or proactive-template sender is enabled until
  consent, template approval, service-window, billing, and suppression checks
  can all be proven.

## Known risks and external gates

- Meta may change portal labels, Embedded Signup parameters, permissions, token
  lifetimes, or review requirements. Revalidate against official documentation
  before submission and record the reviewed Graph API version.
- A real Embedded Signup configuration ID, App Review approval/advanced access,
  verified business, client phone ownership, and client payment setup require
  manual Meta actions.
- The credential encryption key must be created and stored in each hosting
  environment before production connections can be saved. Losing it makes
  encrypted tokens unrecoverable; rotation/backup ownership must be assigned.
- Legal entity name, privacy contact, retention decisions, terms, and deletion
  fulfillment owner require product/legal approval. Repository pages can expose
  accurate placeholders and process, not invent the answers.
- Production pricing, payment provider, tax/invoicing, support SLAs, operational
  owners, production status-verification provider, malware scanner, and final
  retention/RPO/RTO remain separate business/provider decisions.

## Completion notes

Implementation evidence, hosted migration identifiers, deployment URL/commit,
manual gates, deviations, and exact command results will be appended as the
work progresses. A build or Vercel deployment alone will not be described as
broad production readiness.

### Local implementation evidence — 2026-08-25

- `npm run format:check`: pass after applying repository Prettier formatting.
- `npm run lint`: pass.
- `npm run typecheck`: pass, including regenerated database types.
- `npm test`: 38 test files and 169 tests passed.
- `npm run db:reset`: pass from an empty local database through all 20
  migrations and the production-safe seed. An earlier attempt stopped before
  seeding because migration 005 referenced the wrong helper schema; the policy
  was corrected to `private.is_active_member` and the clean reset then passed.
- `npm run db:lint`: pass with no schema errors.
- `npm run db:test`: 15 pgTAP files and 273 assertions passed, followed by the
  reference/handoff/status concurrency and auth/route integration scripts.
- Database type regeneration produced the identical SHA-256 checksum before
  and after generation: `6cf2d1891a0842b3486ffa18f44f0f7767651a9639590e41595fca20d4325a42`.
- `npm run test:ai`: 5 files and 32 tests passed.
- `npm run test:whatsapp`: 6 files and 35 tests passed.
- `npm run test:e2e`: 16 Chromium tests passed, including customer/employee,
  handoff, mobile, accessibility, registration/compliance, recovery, and
  deterministic request journeys.
- `npm run security:secrets`: pass; the scanner includes tracked and untracked
  non-ignored candidate files and emitted browser assets.
- `npm run security:dependencies`: pass against the npm advisory service with
  zero vulnerabilities.
- `npm run build`: pass; Next.js generated all Phase 10 auth, onboarding,
  compliance, administration, Meta API, and existing product routes.
- Hosted migrations and non-mutating schema/security smoke checks are complete.
  Vercel deployment, commit, and push remain pending the final reviewed snapshot.

### Hosted migration evidence — 2026-08-25

- Pre-deployment `supabase migration list --linked` showed exactly migrations
  `20260825000100` through `20260825000600` pending.
- `supabase db push --linked --dry-run` listed only those six reviewed Phase 10
  migrations and no seeds or role changes.
- A restricted-permission data checkpoint was written outside the repository at
  `/private/tmp/smartdesk-phase10-predeploy-data-20260825.sql` (30,006 bytes,
  SHA-256 `361cf558ffd7c53af6b886ddcb56cc1edd29a184d1be9c18ff5d60da66ca95c0`).
  The CLI schema dump returned an empty file, so it is not counted as recovery
  evidence; versioned migrations plus migration history remain the schema
  checkpoint.
- The first push attempt received a retryable Supabase management API/Cloudflare
  502 before database login. After the requested backoff, the push completed.
  A final linked migration list shows local and hosted history aligned through
  `20260825000600`.
- Hosted non-mutating API smoke checks passed for the BuildPro subscription,
  WhatsApp projections, credential service access, anonymous credential denial,
  suppressions, templates, and the trusted empty destination resolver.
- Hosted pgTAP was attempted three times but ran zero assertions because the
  hosted test login cannot resolve pgTAP functions installed outside its search
  path, and the CLI overrides both `PGOPTIONS` and test-file `SET LOCAL` values.
  This is recorded as failed test-run infrastructure, not a passed RLS run. The
  identical migrations passed all 273 assertions locally; hosted anonymous
  credential denial and schema checks passed through normal API roles.
- Vercel was linked to `shabas-projects-ac4e9648/smartdesk-ai-starter`.
  `NEXT_PUBLIC_META_APP_ID`, a newly generated sensitive
  `META_CREDENTIAL_ENCRYPTION_KEY`, and `META_CREDENTIAL_KEY_VERSION=1` were
  configured directly without printing values. The external Embedded Signup
  configuration ID remains unavailable and is the remaining feature gate.
- Git commit `7dbc613c74ec91b0d28d34d636cbda1c98cf5690` was pushed to
  `origin/main`. Vercel production deployment
  `dpl_CrTDnCqduNtUUgMasGj9bfwLuABw` reached `Ready` and the stable alias is
  `https://smartdesk-ai-starter-khaki.vercel.app`.
- Hosted smoke checks passed for the home, registration, login, privacy, and
  BuildPro chat pages; unauthenticated Meta onboarding returned 401; a spoofed
  webhook returned 401; and valid webhook verification returned its challenge.
  No hosted customer/request fixture was created. Authenticated owner/employee
  and real Meta Embedded Signup round trips remain manual gates requiring real
  verified accounts and the missing Meta configuration ID.

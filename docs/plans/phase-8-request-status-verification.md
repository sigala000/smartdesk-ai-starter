# Plan: Phase 8 Request Status Verification

## Goal

Deliver a secure, tenant-isolated customer status lookup that reveals no request
information from a reference alone. A customer enters the organization and
reference, proves control of the request's confirmed phone number through an
expiring challenge, receives a short-lived scoped verification token, and can
then see only an explicitly customer-safe status projection. The same service
will support the existing `get_request_status` agent tool without trusting the
model for tenant identity, verification, or data filtering.

This document plans Phase 8 only. Nothing in this planning task implements the
schema, provider, API, UI, or agent integration.

## User value

Customers can check progress without calling BuildPro while customer contact
details, internal notes, employee identities, assignments, raw status history,
and other tenants' requests remain private.

## Current state

- The repository is a Next.js 16.3 strict-TypeScript modular monolith using
  Supabase PostgreSQL, Auth, and private Storage.
- Phase 7 is present in the working tree but is not yet committed. This plan
  must preserve those changes and must not use Git `HEAD` as a complete picture
  of the current implementation.
- Requests use globally unique, immutable, backend-generated references and are
  scoped by `organization_id`. Customers store a confirmed E.164 phone number.
- Public database tables have no broad anonymous access. Existing public flows
  use server-only repositories, controlled database functions, HMAC-derived
  rate-limit subjects, sanitized API errors, and no-store responses.
- `public.public_rate_limits` and its atomic increment function already provide
  a reusable database-backed pilot rate-limit primitive.
- The API contract already names:
  `POST /api/request-status/challenge`,
  `POST /api/request-status/verify`, and
  `GET /api/request-status/{referenceNumber}`.
- `get_request_status` already has a strict tool schema and definition, but it
  is deliberately excluded from `executableAgentTools`; `ToolExecutor` returns
  `capability_unavailable` for it.
- The deterministic chat action currently truthfully says status verification
  is unavailable. There is no status page, challenge table, provider adapter,
  verification token implementation, or status DTO.
- Existing test infrastructure includes Vitest, pgTAP, local Supabase reset and
  linting, HTTP integration scripts, mocked integration patterns, AI
  evaluations, and production builds.
- Existing server environment validation covers Supabase, OpenAI, Meta,
  attachments, public rate limiting, and the canonical app URL. It has no
  status-verification provider configuration.

## Scope

- A public status page with organization and request-reference entry.
- Phone-number second-factor collection and normalization.
- Challenge creation, delivery abstraction, expiration, attempt limits,
  consumption, resend behavior, and lockout.
- A development-only mock provider and a production provider interface.
- Short-lived, request-scoped verification tokens stored as digests.
- Customer-safe status projection and canonical display mapping.
- Public challenge, verification, and verified-status APIs.
- Layered rate limits for IP, organization, reference/phone subject, challenge,
  and verification token.
- Generic enumeration-resistant responses and security-event recording.
- Integration with deterministic chat and the existing agent tool.
- Unit, database/RLS, integration, mocked-provider, and end-to-end tests.
- Migrations, generated database types, environment documentation, and relevant
  source-of-truth documentation updates.

## Out of scope

- Selecting or deploying a real SMS vendor.
- Email verification, WhatsApp OTP delivery, voice OTP, customer accounts, or
  reusable customer login sessions.
- Production WhatsApp integration.
- Displaying full request details, customer profile data, attachments,
  quotations, conversation transcripts, internal notes, assignment data,
  employee names/contact details, raw audit metadata, or raw status history.
- Customer-side request mutation, acceptance, cancellation, or completion.
- Phase 9 production infrastructure, global edge protection, retention policy,
  localization rollout, or staging deployment.
- Changes to employee request-management permissions.

## Dependencies and assumptions

1. The verified factor is the request customer's confirmed `phone_e164` value.
   The browser supplies a phone only to prove knowledge/control; matching occurs
   server-side after canonical E.164 normalization.
2. `organizationSlug` is required at challenge creation and resolves an active
   organization. Neither a reference nor model output selects tenant scope.
3. The production provider remains an interface in Phase 8. A deployment must
   configure a non-mock implementation before enabling status verification in
   production; no vendor is guessed in this plan.
4. Pilot defaults proposed for implementation review are: six-digit numeric
   code, 10-minute challenge lifetime, five attempts, a 15-minute lockout, a
   15-minute verification-token lifetime, and one-time challenge consumption.
   These are configurable server-side within reviewed bounds and are never
   accepted from the browser.
5. Resending creates a new challenge and invalidates prior open challenges for
   the same request/factor. A cooldown prevents delivery flooding.
6. Because the contracts currently return a challenge-shaped response, unknown
   references and mismatched phone factors create a non-deliverable synthetic
   challenge record or equivalent opaque response. Response status, shape,
   timing envelope, expiration, and subsequent verification failure remain
   indistinguishable from a real challenge to prevent enumeration.
7. Successful status reads do not extend token lifetime. Tokens are scoped to
   one organization and request and may be revoked/consumed according to the
   final migration design.
8. `PUBLIC_RATE_LIMIT_SECRET` remains the HMAC key for pseudonymous abuse
   subjects. A separate status-token signing key is unnecessary if tokens are
   opaque random capabilities whose digests are stored server-side.
9. The mock code may be exposed only through a development-only test response
   or server console/test harness. It must never be logged or returned when
   `NODE_ENV=production`.

No genuine planning blocker was found. The exact production SMS vendor and
operational retention period are intentionally deferred; the interface and
safe defaults let Phase 8 be implemented and tested without pretending a
production provider exists.

## Design

### Trust and data flow

1. The status page posts organization slug, normalized reference, and phone to
   the challenge route.
2. The route validates bounded input, derives an IP/session subject, and calls
   `RequestStatusService.createChallenge`.
3. The repository resolves the active organization, then resolves the request
   and customer within that organization. It never searches globally by phone.
4. The service performs constant-time comparison of a server-derived phone
   digest or canonical phone values without reflecting match results.
5. The service creates a real or synthetic challenge with a random ID, a
   salted/HMAC code digest, expiry, attempt budget, provider mode, and safe
   delivery hint. Plain OTP codes are never stored.
6. Only a real matching challenge is passed to the provider. The API returns
   the same accepted response for real, unknown-reference, and mismatched-factor
   cases.
7. Verification locks the challenge row, applies rate/lockout checks, compares
   the code in constant time, increments failures atomically, and consumes a
   successful challenge exactly once.
8. Successful verification creates a random high-entropy status token. Only its
   digest is stored with trusted organization/request scope and expiry. The
   plaintext token is returned once.
9. The status-read route hashes the bearer token, loads an unexpired unrevoked
   token, verifies its trusted request scope matches the normalized path
   reference, and builds a customer-safe DTO from an allowlisted query.
10. The status page renders that DTO and never receives raw repository rows.

### API contracts

#### `POST /api/request-status/challenge`

- Accept exactly `organizationSlug`, `referenceNumber`, and `phone`.
- Normalize case/spacing for the reference and validate its bounded format.
- Normalize phone input to E.164; never return the normalized full number.
- Apply body-size, content-type, IP, organization, and pseudonymous
  reference/factor limits before provider delivery.
- Always return an accepted challenge-shaped response for syntactically valid
  input, even when no request/factor matches.
- Return `challengeId`, generic `deliveryHint`, and `expiresAt`; include a mock
  code only through an explicit development-only mechanism guarded both by
  environment validation and runtime production checks.
- Use `Cache-Control: no-store` and the repository's trace-ID error convention.

#### `POST /api/request-status/verify`

- Accept exactly `challengeId` and a fixed-format code.
- Return only a generic invalid/expired response for unknown, synthetic,
  expired, consumed, locked, or incorrect challenges.
- Return `429` with a generic retry time for active rate/lockout limits without
  revealing whether the reference exists.
- On success, return the opaque verification token and expiry once.
- Never return a request ID, organization ID, phone, or customer data.

#### `GET /api/request-status/{referenceNumber}`

- Require the short-lived token in an authorization header. Do not place it in
  a query string or persistent browser storage.
- Validate token digest, expiry, revocation, tenant/request binding, and exact
  normalized reference binding on every read.
- Use a uniform not-found/unauthorized response for invalid token, wrong
  reference, expired token, or foreign tenant binding.
- Return only the customer-safe projection below with no-store headers.

### Challenge lifecycle

- States: `pending`, `verified`, `expired`, `locked`, `superseded`, `delivery_failed`.
- Store `expires_at`, `attempt_count`, `max_attempts`, `locked_until`,
  `verified_at`, `consumed_at`, `superseded_at`, and bounded provider outcome.
- Creation and resend serialize on a pseudonymous organization/reference/factor
  subject so concurrent clicks produce at most one deliverable active challenge
  during the cooldown.
- Verification uses a row lock or a narrowly granted security-definer function
  so concurrent correct submissions issue at most one token.
- Failed delivery does not create a usable verification path. The public reply
  remains generic and the security event records a sanitized provider error.
- Cleanup of expired challenges/tokens is retry-safe. Expiry is enforced in
  every authorization query even before cleanup runs.

### Provider abstraction

Create a server-only interface such as:

```ts
interface StatusVerificationProvider {
  sendCode(input: {
    destinationE164: string;
    code: string;
    expiresAt: Date;
    traceId: string;
  }): Promise<
    | { ok: true; providerMessageId?: string }
    | { ok: false; retryable: boolean; code: string }
  >;
}
```

- `DevelopmentMockVerificationProvider` records no secret and performs no
  network request. It is constructible only when an explicit provider mode is
  `mock` and `NODE_ENV !== "production"`.
- A production provider factory accepts only a real provider mode in
  production. `mock`, missing provider configuration, or a mock-code exposure
  flag makes production startup/build fail closed.
- The production interface is implemented with a deliberately unavailable
  adapter until a provider is selected, returning a typed provider-unavailable
  result rather than simulating delivery.
- Provider credentials remain server-only, are validated conditionally, and
  never enter client bundles, database rows, audit metadata, or error bodies.

### Environment configuration

Add bounded server-only variables, with final names confirmed during
implementation:

- `STATUS_VERIFICATION_ENABLED`
- `STATUS_VERIFICATION_PROVIDER=mock|production`
- `STATUS_VERIFICATION_MOCK_EXPOSE_CODE` (development/test only)
- `STATUS_VERIFICATION_CODE_TTL_SECONDS`
- `STATUS_VERIFICATION_TOKEN_TTL_SECONDS`
- `STATUS_VERIFICATION_MAX_ATTEMPTS`
- `STATUS_VERIFICATION_LOCKOUT_SECONDS`
- `STATUS_VERIFICATION_RESEND_COOLDOWN_SECONDS`

The public schema receives none of these. `.env.example` contains blank or safe
disabled values only. Tests prove production parsing rejects mock mode and code
exposure.

### Customer-safe status projection

Create a dedicated DTO with only:

- `referenceNumber`
- `serviceName` (approved public service name or a neutral fallback)
- `displayStatus`
- `lastUpdate`
- `nextAction`
- `updatedAt`

Map canonical statuses through a pure exhaustive function. Customer wording is
coarse and truthful; it must not expose operational workflow details unnecessarily.
`lastUpdate` and `nextAction` are server-owned templates derived from canonical
status, not raw employee reasons, internal notes, audit metadata, model prose,
message bodies, department names, assignment records, or member details.

The repository query must use an explicit column allowlist and must not select
`customers`, `organization_members`, `internal_notes`, unrestricted
`request_status_history.reason`, or message metadata. DTO tests use sentinel
secrets in forbidden fields to prove they cannot serialize.

### Rate limiting and lockout

Use the existing atomic `public_rate_limits` primitive with separate actions:

- `status_challenge_ip`
- `status_challenge_subject`
- `status_verify_ip`
- `status_verify_challenge`
- `status_read_token`

Subjects are HMAC digests, never raw phone numbers, references, IP addresses,
codes, or tokens. Challenge attempt counts provide a second transactional
boundary independent of rate-limit windows. Repeated failures lock the
challenge; repeated challenge abuse temporarily blocks the pseudonymous
reference/factor subject. Success does not reset broader abuse counters.

### Generic failures and timing

- Syntactically valid unknown references, wrong phones, inactive tenants, and
  valid matches receive the same challenge response shape.
- Verification failures share one customer-facing code/message.
- Status-read authorization failures share one response shape.
- Logs and security events retain only pseudonymous subjects, outcome codes,
  counts, trace IDs, and tenant ID when already trusted.
- Add bounded minimum-response timing or equivalent provider-independent work
  where tests demonstrate a meaningful enumeration side channel; do not use
  long sleeps in request handlers.

### Security and audit events

Add a dedicated append-only `status_verification_events` table rather than
putting public verification attempts into employee-facing business audit
history. Record organization when trusted, challenge ID, pseudonymous subject,
event type, outcome code, trace ID, and timestamp. Never record OTP, token,
phone, reference, customer name, provider credential, or message body.

Event types include challenge requested, delivery accepted/failed, verification
failed/locked/succeeded, token read/expired/revoked, and rate limited. Direct
`anon` and `authenticated` access is denied; only controlled server operations
write events.

### Status page

- Add `/status` with an accessible staged form: reference/phone, code, then
  verified result.
- Permit a safe organization slug from the route/query or BuildPro entry point;
  never accept an organization UUID.
- Keep the verification token in component memory only. Do not put it in a URL,
  cookie readable beyond this flow, localStorage, sessionStorage, analytics, or
  logs.
- Provide loading, resend cooldown, generic failure, rate-limit/lockout,
  expiration, restart, empty, and provider-unavailable states.
- Use labelled inputs, autocomplete attributes appropriate for phone and OTP,
  keyboard submission, focus management, mobile layout, and no color-only
  signals.
- Refreshing the page intentionally requires verification again.

### Chat-tool integration

- Replace the deterministic “not available” action with a safe status-flow link
  or an in-chat collection flow that invokes the same challenge service. The
  deterministic path remains fully functional without OpenAI.
- Enable `get_request_status` only after the Phase 8 service exists.
- Extend `ToolServices` with a status callback that calls
  `RequestStatusService`; do not query Supabase from the executor.
- Trusted organization comes from verified conversation context. The model may
  submit only a reference and verification token; it cannot supply organization
  or request IDs.
- The service validates that the token belongs to that organization and exact
  reference before returning the same customer-safe DTO.
- Never place the OTP, verification token, phone, or provider result into model
  context or persisted tool/message metadata. Prefer a deterministic server
  response that renders the verified DTO without asking the model to restate it.
- Tool failure returns a generic verification-required/expired result and makes
  no status claim.

## Database changes

Create one additive Phase 8 migration containing:

1. `status_verification_challenges`, tenant-scoped when a tenant is trusted,
   with nullable request scope for synthetic challenges, code digest, factor
   digest, lifecycle timestamps/state, attempt limits, delivery mode/outcome,
   constraints, and restrictive deletion.
2. `status_verification_tokens`, always tenant/request scoped, with unique token
   digest, expiry, optional revocation/consumption timestamps, and restrictive
   foreign keys.
3. `status_verification_events`, append-only and minimally pseudonymous.
4. Composite tenant foreign keys wherever a row references an organization,
   request, customer, or challenge.
5. Partial indexes for one current challenge per subject, challenge expiry and
   cleanup, token-digest lookup, token expiry, and security-event review.
6. RLS enabled and forced on every new table; no anonymous or authenticated
   table grants/policies.
7. Narrow service-role functions for atomic challenge issuance, attempt/lockout
   verification, token issuance, and verified projection lookup. Functions use
   an empty fixed `search_path`, fully qualified objects, bounded arguments,
   explicit tenant predicates, and reviewed grants.
8. Generated `lib/supabase/database.types.ts` updates.

Do not store plaintext OTPs or status tokens. Do not use a public-readable view.
Do not weaken existing request/customer RLS to implement public status lookup.

### Migration and rollback safety

- Use an additive timestamped migration; never edit a deployed migration.
- Create tables and functions before enabling application code.
- Avoid table rewrites and destructive backfills; no existing request row needs
  modification.
- Use `CREATE INDEX` normally for the local/pilot empty tables; reassess
  concurrent index creation only if production volume exists at deployment.
- Test the migration from a clean reset and against a database containing
  requests.
- Rollback is application-first: disable the feature/provider, revoke function
  execution, then retain challenge/event/token rows until the retention policy
  permits deletion. Do not drop evidence as an emergency rollback.
- Expired-row cleanup must be a separate bounded command/function and must not
  be required for authorization correctness.

## Application boundaries

- `lib/domain/request-status.ts`: status label/projection rules and lifecycle
  constants.
- `lib/schemas/request-status-api.ts`: strict public request/query/header input.
- `lib/dto/request-status-dto.ts`: the only public status response type.
- `lib/repositories/request-status-repository.ts`: organization-scoped
  interface with no provider or UI concerns.
- `lib/repositories/supabase-request-status-repository.ts`: explicit scoped
  queries/RPC calls.
- `lib/services/request-status-service.ts`: challenge, provider coordination,
  verification, lockout, token validation, safe projection, typed results, and
  security events.
- `lib/services/request-status-runtime.ts`: server-only dependency wiring.
- `lib/verification/`: provider interface, development mock, unavailable
  production adapter, factory, and normalized provider errors.
- Route handlers validate/map HTTP only; React components contain no security or
  status business rules.

## Milestones

1. **Database and domain foundation**
   - Add migration, RLS/grants, transactional functions, domain mappings,
     schemas, DTO, generated types, and pgTAP integrity/isolation tests.
2. **Challenge and provider services**
   - Add server-only provider interface/factory, development mock guard,
     repositories, typed service results, challenge expiration/attempts,
     token issuance, rate limiting, generic failures, and security events.
3. **Public APIs and status UI**
   - Add three routes, `/status`, staged accessible forms, in-memory token use,
     loading/error/lockout/restart states, and deterministic chat entry.
4. **Agent integration and hardening**
   - Wire the existing tool to the service, keep verified status deterministic,
     add negative leakage/cross-tenant/concurrency tests, update documentation,
     and run all quality gates.

## Expected file changes

### Create

- `supabase/migrations/<timestamp>_phase_8_request_status_verification.sql`
- `supabase/tests/013_request_status_verification.sql`
- `lib/domain/request-status.ts`
- `lib/schemas/request-status-api.ts`
- `lib/dto/request-status-dto.ts`
- `lib/repositories/request-status-repository.ts`
- `lib/repositories/supabase-request-status-repository.ts`
- `lib/services/request-status-service.ts`
- `lib/services/request-status-runtime.ts`
- `lib/verification/status-verification-provider.ts`
- `lib/verification/development-mock-provider.ts`
- `lib/verification/production-provider.ts`
- `lib/verification/provider-factory.ts`
- `app/api/request-status/challenge/route.ts`
- `app/api/request-status/verify/route.ts`
- `app/api/request-status/[referenceNumber]/route.ts`
- `app/status/page.tsx`
- `app/status/loading.tsx`
- `app/status/error.tsx`
- `components/status/request-status-flow.tsx`
- `tests/unit/status/request-status-domain.test.ts`
- `tests/unit/status/request-status-schemas.test.ts`
- `tests/unit/status/request-status-service.test.ts`
- `tests/unit/status/status-provider-factory.test.ts`
- `scripts/test-request-status-routes.mjs`

### Modify

- `.env.example`
- `package.json`
- `lib/config/env-schema.ts`
- `lib/agent/tool-executor.ts`
- `lib/agent/tool-definitions.ts`
- `lib/services/public-conversation-runtime.ts`
- `lib/domain/conversation-workflow.ts`
- `components/chat/public-chat.tsx`
- `lib/supabase/database.types.ts` (generated)
- `docs/04_ARCHITECTURE.md`
- `docs/06_AGENT_BEHAVIOR.md`
- `docs/07_API_CONTRACTS.md`
- `docs/08_SECURITY_AND_PRIVACY.md`
- `docs/09_TESTING_AND_ACCEPTANCE.md`
- `docs/11_DECISIONS.md`
- this execution plan

Exact file names may be adjusted to existing conventions during implementation;
all deviations must be recorded here before completion.

## Test plan

### Unit tests

- Reference, E.164 phone, challenge ID, OTP, bearer-token, and environment
  schemas accept valid bounded values and reject extra/scope-injection fields.
- Every canonical request status maps exhaustively to approved display status,
  last update, and next action.
- DTO serialization cannot contain internal-note text, raw reasons, customer
  phone/email, department/member IDs, employee names, assignments, audit data,
  conversations, attachments, or provider metadata.
- Challenge expiry boundaries use an injected clock.
- Attempts increment atomically in service results; the final allowed failure
  locks the challenge and later correct codes remain rejected.
- A consumed, superseded, expired, locked, foreign, or delivery-failed challenge
  cannot issue a token.
- Tokens reject wrong reference, wrong organization, expiry, revocation, and
  malformed credentials.
- Mock provider factory rejects production and exposes a code only when both
  explicitly enabled and non-production.
- Provider timeout/failure produces generic errors and no usable challenge.
- Rate-limit subject digests contain no raw phone/reference/IP/token.
- Tool arguments cannot inject organization/request IDs; the executor calls the
  service and returns only a verified DTO.

### Database and RLS tests

- New tenant tables have RLS enabled and forced, correct constraints/indexes,
  and no `anon`/`authenticated` broad grants.
- Composite foreign keys reject cross-tenant request/challenge/token links.
- Plain codes and tokens are absent from stored rows.
- Concurrent challenge creation leaves one deliverable active challenge during
  cooldown.
- Concurrent successful verification issues exactly one token.
- Attempt exhaustion and lockout are atomic under simultaneous failures.
- Expiry is enforced by database operations regardless of cleanup.
- A valid token can read exactly its request projection; the same token cannot
  read another request in the same or another tenant.
- Reference-only, phone-only, challenge-only, service-role omission, and direct
  table access reveal nothing.
- Security events are append-only and contain no raw sensitive values.

### HTTP integration tests

- Real matching, nonexistent reference, wrong phone, and inactive tenant return
  indistinguishable challenge response/status shapes.
- Invalid syntax is rejected before lookup without confirming existence.
- Development mock delivery completes the happy path locally.
- Wrong, expired, exhausted, reused, and concurrent OTP attempts fail safely.
- Duplicate challenge and verify clicks are retry-safe.
- Reference-only GET, missing token, wrong token, token/reference swap,
  cross-tenant token, expired token, and revoked token return the same safe
  authorization failure.
- Successful GET returns only the approved DTO and no cacheable response.
- Provider failures do not claim delivery and do not issue a usable token.
- Rate limits apply independently to challenge, verify, and read operations;
  `Retry-After` is bounded and generic.
- Trace IDs exist while response/log fixtures contain no phone, OTP, token,
  internal note, employee data, provider credentials, or stack trace.
- Run the HTTP suite twice without reset to prove cleanup/idempotency safety.

### End-to-end tests

- Customer opens `/status`, enters BuildPro reference and phone, receives a mock
  challenge, verifies it, and sees the safe current status.
- Reference alone never advances to or renders a status.
- Wrong phone and unknown reference show the same neutral flow.
- Expired challenge prompts a safe restart; exhausted attempts show temporary
  lockout; resend supersedes the previous code.
- Duplicate submit clicks do not send duplicate deliverable challenges or issue
  multiple tokens.
- Refresh after success loses the in-memory token and requires verification.
- Mobile/keyboard flow, focus movement, loading states, and generic errors work.
- Deterministic chat directs status lookup correctly without OpenAI.
- Mocked-agent status tool returns the same safe DTO only with a valid token and
  reveals nothing for another customer's reference.

## Security review

- Reference alone is never authorization and never changes response content in
  a way that confirms existence.
- Organization is resolved from an active slug or trusted conversation context;
  tenant UUIDs from public/model input are rejected.
- All new tenant relationships use composite organization foreign keys and
  explicit repository filters. RLS remains deny-by-default.
- OTPs and verification tokens use cryptographically secure randomness and are
  stored only as digests. Comparisons are constant-time where application code
  performs them.
- Browser tokens are short-lived, memory-only, request-scoped, no-store, and
  absent from URLs/logs/analytics.
- Provider credentials, Supabase service-role credentials, phone numbers, OTPs,
  and tokens remain server-side and redacted.
- The mock provider is structurally disabled in production through both
  environment parsing and runtime factory checks.
- Customer DTOs are allowlists constructed by trusted code; denylist filtering
  of broad request rows is not acceptable.
- Agent output cannot authorize or restate unverified data. The status service,
  not the model, validates the token and produces display text.
- Rate limiting and per-challenge attempt locking are both required; either one
  alone is insufficient against distributed guessing or concurrent attempts.
- Provider response bodies and message identifiers are not returned publicly.
- Security events are useful for abuse review without becoming a new store of
  customer secrets.

## Commands to run during implementation

Repository inspection and generation:

```bash
git status --short
npm ci
npm run db:start
npm run db:reset
npm run db:types
```

Focused and database verification:

```bash
npx vitest run tests/unit/status tests/unit/agent
npm run db:lint
npm run db:test
node scripts/test-request-status-routes.mjs
```

Full quality gates:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:ai
npm run test:whatsapp
npm run build
git diff --check
git status --short
```

Do not claim clean-checkout or hosted verification unless it is actually run.
Never print `.env.local`, provider credentials, OTPs outside the explicit local
mock test path, or verification tokens in command output.

## Acceptance criteria

- A syntactically valid reference without a verified factor returns no request
  or existence signal.
- Unknown reference, wrong phone, and valid match have indistinguishable public
  challenge responses except for an explicitly development-only mock test hook.
- A valid challenge expires, has a bounded attempt count, locks atomically, and
  cannot be reused.
- Concurrent correct verification produces at most one valid token.
- The short-lived token authorizes exactly one organization/request/reference
  and cannot be extended by reading status.
- The mock provider cannot start, build, or send codes in production.
- A production provider interface exists and unavailable production delivery is
  reported truthfully without simulating success.
- Verified customers receive only the six allowlisted DTO fields.
- Internal notes, raw history reasons, customer contact data, attachments,
  employee identity/contact data, assignments, and audit metadata never appear
  in APIs, UI, agent context/output, or logs.
- Rate limits and escalating lockout are tested, tenant-safe, and use
  pseudonymous subjects.
- Security events record outcomes without raw reference, phone, code, or token.
- The status page covers loading, expiration, lockout, resend, generic error,
  restart, and success states accessibly.
- Deterministic chat and the AI tool reuse the same application service; neither
  can bypass verification.
- Cross-tenant, reference-only, token-swap, duplicate-click, and concurrency
  negative tests pass.
- Database reset/lint/tests, formatting, lint, strict typecheck, all unit and
  integration tests, AI tests, WhatsApp regressions, and production build pass.
- Phase 9 is not started.

## Progress log

- [x] Read repository instructions, the required user-specified documents, and
      the backend/customer/planning documents required by `docs/00_INDEX.md`.
- [x] Inspect the actual working tree, package scripts, environment validation,
      current database schema/migrations/RLS, public rate limits, API routes,
      deterministic status action, agent tool definition/executor, generated
      types, and existing test structure.
- [x] Identify current gaps, dependencies, non-blocking assumptions, and
      documentation/repository consistency.
- [x] Create this Phase 8 execution plan only.
- [x] Review and approve the plan.
- [x] Milestone 1: database and domain foundation.
- [x] Milestone 2: challenge and provider services.
- [x] Milestone 3: public APIs and status UI.
- [x] Milestone 4: agent integration, security hardening, and full verification.
- [x] Record exact implementation commands, results, deviations, and remaining
      limitations in completion notes.
- [x] Post-implementation audit hardening: make browser tokens single-use,
      isolate model status access behind conversation-bound server grants,
      audit reads/rejections, defer external delivery, and add concurrency and
      cross-tenant negative tests.

## Decision log

- 2026-08-11: Treat the confirmed request phone as the initial second factor;
  reference knowledge alone has no authority.
- 2026-08-11: Use opaque random status tokens stored only as digests instead of
  self-contained browser-readable tokens. This permits immediate revocation and
  narrow request binding without a new signing secret.
- 2026-08-11: Return synthetic challenge-shaped responses for unknown/mismatched
  lookups to resist reference and phone enumeration.
- 2026-08-11: Keep customer status text as an exhaustive server-owned mapping,
  never raw status-history reasons or model-generated prose.
- 2026-08-11: Use a development-only mock behind two fail-closed guards and
  defer the real SMS vendor choice while preserving a production interface.
- 2026-08-11: Keep verification tokens in browser memory and out of URLs,
  persistent storage, and general conversation history.
- 2026-08-11: Reuse the existing database-backed HMAC rate limiter and add
  transactional per-challenge attempts; these controls address different abuse
  paths.
- 2026-08-11: Enable the existing agent tool only through the Phase 8
  application service and prefer deterministic rendering of verified results.
- 2026-08-11: Never place a status verification token in conversation history
  or model context. A verified web flow may mint a separate digest-only grant
  bound to the trusted organization and public conversation; the status tool
  receives only the reference and consumes that grant server-side.
- 2026-08-11: Status browser tokens and conversation grants are single-use.
  Atomic database functions consume them, return only the customer-safe
  projection, and record both accepted and rejected presentations.
- 2026-08-11: Apply IP and subject abuse limits before request lookup and defer
  external provider delivery until after the generic HTTP response so request
  existence is not exposed through provider latency.

## Known risks and limitations

- No production SMS provider has been selected. Phase 8 can be completed and
  tested locally, but production status verification remains disabled until a
  provider implementation and credentials are reviewed.
- SMS/phone control is a modest second factor, not strong identity proof. SIM
  swap, shared numbers, recycled numbers, and delayed messages remain risks.
- The documented customer model permits shared phone numbers. Status tokens
  therefore bind to a specific request, not to every request with that phone.
- Synthetic challenge handling and post-response provider delivery remove the
  principal provider-latency enumeration signal. Edge timing monitoring remains
  required because infrastructure and database caches can still vary.
- Database-backed pilot rate limits do not replace edge/WAF controls against
  large distributed attacks; Phase 9 must add deployment-level protection.
- Challenge/token/security-event retention is not yet a production policy.
  Proposed short operational cleanup defaults must be documented and approved
  before real customer deployment.
- A browser refresh intentionally loses verification state and requires a new
  challenge; this favors privacy over convenience for the MVP.
- English-first status labels remain consistent with current MVP scope; French
  localization foundation is Phase 9.

## Completion notes

Implemented on 2026-08-11. Migration
`20260811000300_phase_8_request_status_verification.sql` adds forced-RLS,
digest-only challenge/token/event storage and atomic verification. The app now
provides challenge, verification, and status endpoints, an accessible `/status`
flow, a development-only mock, a truthful unavailable production provider,
deterministic chat navigation, and the agent tool through the same service.
Exact final command results are recorded after the final quality gate run.

Final verification on 2026-08-11:

- `npm run db:reset`: passed from every version-controlled migration and the
  production-safe seed.
- `npm run db:lint`: passed with no schema errors.
- `npm run db:test`: passed with 231 pgTAP assertions, 20 concurrent unique
  references, one-winner handoff concurrency, one-winner status-verification
  concurrency, 12 employee Auth checks, 9
  protected-route checks, 29 request-route checks, the public-conversation and
  attachment journeys, and 14 Phase 8 status E2E checks.
- `npm run db:types`: passed and regenerated checked-in database types.
- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 148 tests in 32 files.
- `npm run test:ai`: passed, 30 tests in 5 files.
- `npm run test:whatsapp`: passed, 27 tests in 5 files.
- `npm run build`: passed with the status page and all three status API routes.
- `git diff --check`: passed.

Implementation hardening additionally reuses one active challenge for duplicate
clicks, rate-limits status-token reads, uses tenant-independent public abuse
buckets before factor matching, and never claims delivery when the provider is
unavailable. No production SMS provider was added and Phase 9 was not started.

Post-audit hardening on 2026-08-11 changed status credentials to single-use,
added atomic audited token/grant consumption, removed verification tokens from
the agent schema and OpenAI context, bound chat authorization to the trusted
public-conversation cookie and tenant, deferred external delivery work until
after the generic response, safely handles malformed encoded references, and
added simultaneous-verification, replay, audit-event, and cross-tenant tests.

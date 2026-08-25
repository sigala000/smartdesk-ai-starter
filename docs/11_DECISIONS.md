# Architecture Decision Log

Record durable decisions here. Do not rewrite history; mark replaced decisions as superseded.

## ADR-001: Start with one construction tenant

Status: Accepted

Decision:

Build and test the first complete workflow using BuildPro Cameroon.

Reason:

A concrete tenant prevents vague generic behavior while the schema still includes organization boundaries for future clients.

Consequence:

Construction examples are seed configuration, not hard-coded global business rules.

## ADR-002: Multi-tenant data model from the beginning

Status: Accepted

Decision:

Tenant-owned data includes `organization_id`, with RLS and server-side authorization.

Reason:

The product is intended to be sold to multiple companies. Retrofitting isolation later is risky.

Consequence:

Every repository and test must consider organization scope.

## ADR-003: Web chat before production WhatsApp

Status: Accepted

Decision:

Validate the product through web chat first.

Reason:

It reduces integration complexity and allows the request workflow, dashboard, and AI behavior to be tested independently.

Consequence:

Channel abstractions should permit WhatsApp later, but production WhatsApp code is out of MVP scope.

## ADR-004: Modular monolith

Status: Accepted

Decision:

Use one Next.js application with clear internal modules.

Reason:

It is simpler to build, deploy, debug, and sell during the MVP stage.

Consequence:

Avoid premature microservices. Maintain boundaries in code so modules can be extracted later if justified.

## ADR-005: Supabase as system of record

Status: Accepted

Decision:

Use Supabase PostgreSQL, Auth, and Storage.

Reason:

It provides the required foundations with a manageable operational burden.

Consequence:

Database migrations and RLS policies are first-class code artifacts.

## ADR-006: OpenAI Responses API with controlled tools

Status: Accepted

Decision:

Use the Responses API for agent interaction and expose a small set of server-executed tools.

Reason:

The model can guide conversation while business state changes remain deterministic and validated.

Consequence:

No arbitrary database or code-execution tool is exposed to the customer-facing model.

## ADR-007: Core request flow works without AI

Status: Accepted

Decision:

Implement a deterministic structured request path before adding the model.

Reason:

The company must still capture requests when the AI provider is unavailable, and business correctness must not depend on language-model behavior.

Consequence:

The AI layer uses the same application services as non-AI routes.

## ADR-008: Human approval for prices and quotations

Status: Accepted

Decision:

The assistant may collect requirements and summarize them but cannot approve or invent prices.

Reason:

Construction pricing requires authorized business and technical judgment.

Consequence:

`quotation_sent` requires an authorized employee action and approved document.

## ADR-009: Private attachments

Status: Accepted

Decision:

All customer and quotation files are stored privately and accessed through short-lived signed mechanisms.

Reason:

Files may contain personal and commercially sensitive information.

Consequence:

Permanent public URLs are prohibited.

Phase 6 implementation note (2026-08-10): one private
`private-attachments` bucket uses trusted
`organization/target/random-attachment-UUID` paths. JPEG, PNG, and PDF files are
limited to 10 MiB and validated from stored bytes before activation. Upload
tokens are one-path capabilities and downloads expire after 60 seconds. Files
are never sent to OpenAI automatically.

## ADR-010: Request reference is not authentication

Status: Accepted

Decision:

Status lookup requires the reference plus a verified second factor.

Reason:

Human-readable references can be shared or guessed.

Consequence:

Public status APIs require a challenge flow and return only customer-safe fields.

## ADR template

```markdown
## ADR-XXX: Title

Status: Proposed | Accepted | Superseded | Rejected

Decision:

Reason:

Alternatives considered:

Consequences:

Superseded by:
```
# Implemented Phase 1 database decisions

- 2026-08-06: Tenant relationships use composite `(organization_id, id)` foreign keys, and tenant identifiers are immutable after insertion.
- 2026-08-06: Request references use an atomic per-organization, per-UTC-year counter updated with `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`; references cannot be supplied or changed by callers.
- 2026-08-06: Database access is deny-by-default. Anonymous table access is absent, authenticated access requires an active membership, and ambiguous operational roles remain denied until a later phase defines them.
- 2026-08-06: BuildPro configuration and approved fictional knowledge are reset-safe seed data. Operational examples are stored separately and require an explicit local-only command.
- 2026-08-06: PostgreSQL enums and optional production extensions are deferred. Evolving values use checked text columns; pgTAP is enabled only by the test harness.
- 2026-08-07: Used request prefixes and generated references are immutable, and request references are globally unique so tenant-prefix reuse cannot create ambiguous customer-facing identifiers.
- 2026-08-07: Authenticated roles cannot directly create attachment metadata, request status history, or general audit events. These records require controlled server operations or database triggers that derive trusted context.
- 2026-08-07: Tenant roots and retained operational history use restrictive deletion behavior. Destructive retention work requires an explicit future workflow rather than cascading parent deletion.

# Implemented Phase 2 authentication decisions

- 2026-08-07: Employees authenticate with administrator-provisioned, verified email/password accounts. Global self-signup is disabled; the email provider remains enabled because disabling it also disables password login.
- 2026-08-07: Protected server renders and actions validate the Auth user and resolve organization membership through the employee's RLS-bound Supabase client. The service-role key is not part of normal employee authentication.
- 2026-08-07: Phase 2 permits exactly one active membership in one active organization. Zero, deactivated, unknown-role, inactive-organization, and multiple-membership states fail closed.
- 2026-08-07: Navigation visibility is role-aware presentation only. Every role-limited destination independently enforces its permission on the server.
- 2026-08-07: Session cookies use the supported Supabase SSR client and Next.js request proxy for refresh, while server-side access resolution remains the authorization boundary.
- 2026-08-07: Logout attempts global revocation first and then local session cleanup; if both operations fail, the application reports a sanitized failure instead of claiming the employee was signed out.
- 2026-08-07: Protected-route authorization is regression-tested over HTTP against a real local Supabase Auth session. Next.js streamed redirects may return an HTTP 200 shell, so tests also verify the embedded redirect destination and absence of protected content.

# Implemented Phase 3 request-management decisions

- 2026-08-07: Request data access is isolated in organization-scoped repository modules; application services own permissions, workflow rules, and typed business outcomes.
- 2026-08-07: Assignment, status, note, and request-information mutations use narrowly granted authenticated database functions. Tenant and actor identity come from Auth, and direct authenticated table writes are denied.
- 2026-08-07: Request pagination uses `(created_at desc, id desc)` and a validated versioned cursor. Search is bounded and uses no new PostgreSQL extension at pilot scale.
- 2026-08-07: The canonical documented status graph remains represented, but Phase 3 execution uses a closed transition-pair allowlist enforced identically by services and PostgreSQL. Admin, manager, and commercial roles may perform only the supported intake transitions; support officers are further limited to support/complaint requests; technical officers, project managers, and viewers receive no Phase 3 status mutations.
- 2026-08-07: Status transitions that imply a site visit, quotation delivery or response, project authorization, completion, or administrative reopen fail closed until their required evidence models and authorization workflows exist. Free-text reasons and generic PDF attachments are not accepted as substitutes for structured provenance.
- 2026-08-07: Internal notes use an employee-only allowlist and never enter customer-safe DTOs. Attachment storage paths, system/tool messages, and raw audit metadata are excluded from request APIs.
- 2026-08-07: Request-more-information records an employee question only on an existing active conversation and never claims delivery. Public delivery/reply remains Phase 4/7 work.

# Implemented Phase 4 public-conversation decisions

- 2026-08-08: The complete customer request path is deterministic and has no OpenAI dependency. Phase 5 must reuse the same stored draft and confirmation transaction.
- 2026-08-08: Public conversation authorization uses a 32-byte opaque secret in an HttpOnly same-site cookie. Only its SHA-256 digest is stored; conversation UUIDs and references are not authorization.
- 2026-08-08: Draft fields live in a tenant-owned one-to-one table and remain authoritative. Messages are a preserved transcript and duplicate client message UUIDs do not advance the draft twice.
- 2026-08-08: Confirmation accepts only a true confirmation flag, nonce, and idempotency UUID. A single database transaction reads the server draft, creates or resolves the customer, allocates the reference, creates and routes the request, links the conversation, records history, and audits creation.
- 2026-08-08: Public APIs have no anonymous table grants. A server-only service-role adapter performs organization-scoped reads and controlled security-definer calls; the key never enters browser code.
- 2026-08-08: Pilot public rate limits use atomically incremented PostgreSQL windows keyed by server-side HMAC subjects. Distributed and edge abuse controls remain Phase 9.

# Implemented Phase 5 agent-orchestration decisions

- 2026-08-10: OpenAI Responses API access is isolated in a `server-only` adapter. AI is explicitly configurable and the Phase 4 deterministic flow remains available when it is disabled or unavailable.
- 2026-08-10: System instructions are version-controlled application policy. Organization configuration, customer messages, and knowledge excerpts are untrusted data and cannot replace those instructions.
- 2026-08-10: The model receives a bounded customer-safe context and strict tool descriptions, never credentials or tenant authority. Organization and conversation scope come from the verified opaque-token context.
- 2026-08-10: Structured conversation drafts remain authoritative. Model field proposals pass strict schemas and the public conversation application service; request creation continues through the Phase 4 confirmation transaction only.
- 2026-08-10: The agent tool registry is limited to the six documented tools. Later-phase status, handoff, and attachment capabilities return unavailable until their dedicated services exist and may not simulate success.
- 2026-08-10: Tool loops, history, input, output, and provider duration are bounded. Invalid output, injection attempts, provider errors, and loop exhaustion produce deterministic customer-safe responses.

## 2026-08-10: Stateless agent continuation replays provider output

Phase 5 keeps OpenAI response storage disabled. Tool-result continuation therefore replays the prior response output items alongside correlated function outputs rather than relying on `previous_response_id`. This preserves the server's stateless/privacy choice and follows the provider's stateless continuation contract.

Only tools backed by completed application services are exposed to a model turn. The full six-tool registry remains as a defensive allowlist, but unavailable later-phase capabilities are not advertised and cannot produce a success claim.

Final customer text is accepted only when deterministic validation finds no prohibited price, promise, prompt disclosure, unsupported company claim, ungrounded reference, or unverified action claim. Company and action claims must be supported by successful current-turn tool results. Structured draft fields remain authoritative, and replacing a populated field requires explicit customer correction evidence.

# Implemented Phase 5b WhatsApp test decisions

- 2026-08-10: Meta's developer test number is a transport adapter around the existing public conversation service and Phase 5 orchestrator; it has no separate agent, prompt, draft workflow, request creator, or reference allocator.
- 2026-08-10: A signature-verified destination phone-number ID resolves one active test account and organization. Sender content, profile names, and model output cannot select tenant scope.
- 2026-08-10: Provider-message uniqueness and database processing claims precede model execution. Canonical customer content is committed by the existing conversation service before the shared agent is invoked.
- 2026-08-10: WhatsApp confirmation is recognized only from the authoritative review stage, issues server-held nonce material, and calls the existing idempotent `confirm_public_request` transaction.
- 2026-08-10: Outbound prose and intent are persisted before Meta sending. Ambiguous provider failures are not blindly retried because Cloud API text sends have no application-controlled idempotency key.
- 2026-08-11: WhatsApp processing failures release their inbound claim, while duplicate callbacks during an active lease return a retryable response instead of prematurely acknowledging unfinished work. Explicit Meta 429 responses retry only the persisted outbox reply; timeouts and server errors remain `delivery_unknown` for review.
- 2026-08-11: WhatsApp applies authenticated tenant-account, sender, and agent-turn limits using the existing PostgreSQL rate-limit primitive. A limited turn is preserved with a deterministic customer-safe reply and never reaches OpenAI.
- 2026-08-11: Webhook bodies are size-limited during streaming. Meta verification query strings require infrastructure-level redaction because the provider protocol places the shared verify token in the URL.

# Implemented Phase 7 human handoff decisions

- 2026-08-11: The persisted handoff status is authoritative. Assignment and
  joining are separate; only `active` supports a claim that an employee joined.
- 2026-08-11: One open handoff per conversation is enforced by a partial unique
  index and row-locked idempotent creation. Priority may be elevated by later
  safety evidence but not silently downgraded.
- 2026-08-11: The shared web/WhatsApp conversation service persists customer
  messages and skips OpenAI while a handoff is open. Employee ownership and
  automation resume require explicit database transitions.
- 2026-08-11: Request-information questions and responses carry the request ID.
  Confirmed conversations may reopen through the controlled employee action,
  and the customer's response returns the same request to `new` atomically.

# Implemented Phase 8 request-status decisions

- 2026-08-11: Status verification uses the confirmed request phone, opaque
  challenges, and short-lived random tokens stored only as HMAC digests.
- 2026-08-11: Unknown references and mismatched factors receive synthetic
  accepted challenges. Transactional attempts and database rate limits bound
  guessing without disclosing existence.
- 2026-08-11: The local mock is blocked by environment and runtime production
  checks. The production interface fails truthfully until an SMS vendor exists.
- 2026-08-11: Customer status is a server-owned allowlist; raw request rows,
  notes, priorities, assignments, employees, and history reasons remain private.
# ADR-016: Client-owned Meta assets through Embedded Signup

Status: Accepted

Decision:

Use one reviewed Meta app and webhook. Each tenant authorizes company-owned WABA
and phone assets through Meta Embedded Signup. Destination assets resolve the
tenant; credentials are encrypted server-side. Meta bills each client directly.

Reason:

This enables self-service SaaS onboarding without collecting Meta passwords,
OTPs, payment cards, or sharing a SmartDesk credit line.

Consequence:

ADR-003's web-first sequencing remains historical, but its production-WhatsApp
deferral is superseded by Phase 10. Meta approval, verification, phone setup,
terms, and billing remain external/manual gates. The channel continues to reuse
one SmartDesk agent and existing application services.

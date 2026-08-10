# Plan: Phase 5 OpenAI Agent Orchestration

## Goal

Add a server-only OpenAI Responses API orchestration layer to the existing public BuildPro conversation flow. The layer will recognize natural-language intent, retrieve approved tenant knowledge, propose validated draft-field updates, and select one safe next question while preserving the Phase 4 deterministic workflow as the authority and outage fallback.

Phase 5 is complete only when model text and tool requests are treated as untrusted proposals, every state change passes through an existing application service, request creation still requires the server-stored summary/nonce/confirmation transaction, provider failures preserve the customer message, and the complete quotation journey remains usable with OpenAI disabled or unavailable.

## User value

Customers can describe their needs naturally and receive concise, grounded guidance without learning internal field names or menus. BuildPro gains a more flexible intake experience without allowing a model to invent company facts, make business decisions, cross tenant boundaries, or bypass deterministic request rules.

## Current state

Repository inspection on 2026-08-10 found:

- Next.js 16.3, React 19, strict TypeScript, Zod, Vitest, Supabase, ESLint, Prettier, and npm lockfile installation are configured.
- No `lib/agent/`, `lib/openai/`, OpenAI SDK dependency, Responses API call, prompt module, tool registry, tool executor, model evaluation runner, or AI observability module exists.
- `OPENAI_API_KEY` and `OPENAI_MODEL` are optional server-only environment variables. They are not exposed through `NEXT_PUBLIC_*`, but Phase 5-specific validation and a deliberate disabled mode are not implemented.
- Phase 4 provides opaque-cookie conversation authorization, server-resolved organization scope, rate limiting, a deterministic state machine, server-owned/versioned structured drafts, atomic duplicate-safe message persistence, summary nonce issuance, and an idempotent transaction-safe confirmation RPC.
- The current message endpoint accepts structured menu actions and answers. It persists the customer message and deterministic assistant reply together through `process_public_message`; it does not accept general natural-language input as a separate mode or invoke an external provider.
- Approved BuildPro FAQ entries and active service descriptions exist in tenant-scoped `knowledge_documents` and `services`. There is no customer-safe knowledge repository/application service yet.
- Request creation is implemented through `PublicConversationService` and `confirm_public_request`. The browser/model cannot submit customer/request fields or a reference during confirmation.
- `human_handoffs`, `attachments`, and request status/history tables exist, but safe public handoff, attachment lifecycle, and verified status-lookup application services are not implemented. Those complete workflows remain Phases 6–8.
- The working tree contains the completed Phase 3 and Phase 4 implementation and documentation. Phase 5 implementation must preserve and review those changes rather than treating the current branch as a clean baseline.
- A clean local Phase 4 verification passed all seven migrations, 108 pgTAP assertions, reference concurrency, Auth/RLS, protected/request routes, public-conversation E2E, lint, typecheck, 49 unit tests, and production build.

## Documentation reconciliation

No contradiction blocks planning. These implementation boundaries resolve differences without changing product intent:

1. The API contract shows a free-text `message`, while Phase 4 currently accepts a structured action/answer union. Phase 5 will add a bounded natural-language variant while retaining the structured variants and their deterministic behavior.
2. The six documented tools are the complete Phase 5 allowlist, not a requirement to bypass later phases. All six receive schemas and registry entries. A tool is exposed to a model turn only when a completed application service can execute it safely. Until Phases 6–8 provide those services, status, handoff, and attachment operations return or route to a deterministic `capability_unavailable` outcome and never fabricate success.
3. The documented `save_conversation_fields` input mentions `conversation_id`; the model must not choose it. The executor will ignore/reject model-supplied scope and use the trusted conversation context established from the opaque token. The same rule applies to every tool identifier that is already known by the server.
4. The documented `create_customer_request` tool includes confirmation material. The model must never mint or infer a nonce. The normal browser confirmation endpoint remains authoritative; the tool may execute only with server-held confirmation context created after an explicit customer confirmation event.
5. Official OpenAI guidance evolves. The model name remains environment-configured and allowlisted rather than hard-coded into business logic. Planning on 2026-08-10 resolved the current recommended model as `gpt-5.6-sol`, but implementation must re-check official compatibility and pin an explicitly reviewed model identifier before deployment.

## Scope

- Server-only OpenAI JavaScript/TypeScript SDK and Responses API adapter.
- Explicit enabled/disabled AI mode with server environment validation.
- Allowlisted model configuration, response timeout, maximum output tokens, history budget, tool-call limit, and per-turn cost/usage thresholds.
- Stable version-controlled system instructions plus constrained organization display/configuration data.
- Tenant-scoped conversation-context builder with structured draft authority and bounded recent history.
- Natural-language intent recognition and candidate field extraction.
- Deterministic next-question calculation after validated field persistence.
- Approved, active, tenant-scoped company knowledge retrieval.
- An exact six-tool registry, strict argument/result schemas, permission metadata, and availability gating.
- Tool execution exclusively through application services with trusted server context.
- Bounded Responses API tool-result continuation loop.
- Output validation, forbidden-claim checks, customer-safe persistence, and deterministic fallback.
- AI-specific rate limits, observability metadata, token/cost controls, and sanitized provider errors.
- Unit tests, mocked adapter/orchestrator integration tests, deterministic evaluation fixtures, prompt-injection tests, forbidden-claim tests, and preservation of Phase 4 E2E behavior.
- Documentation and decision-log updates for delivered behavior.

## Out of scope

- Replacing or weakening the deterministic Phase 4 path.
- Automatic pricing, quotation creation/approval, scheduling promises, engineering/legal/financial advice, or autonomous business decisions.
- Multiple agents, agent-to-agent delegation, Agents SDK orchestration, background agents, arbitrary web search, code execution, shell access, MCP, or arbitrary URL/database tools.
- Fine-tuning, production vector infrastructure, embeddings, or a generic retrieval platform. Phase 5 starts with bounded PostgreSQL-backed approved-document search.
- Attachment upload/storage completion, content extraction, vision analysis, malware scanning, or sending uploaded files to OpenAI; Phase 6 owns these.
- Complete customer reply/human-handoff queue workflow; Phase 7 owns it.
- Status challenge/second-factor verification; Phase 8 owns it.
- Streaming UI, voice, WhatsApp, French localization, asynchronous job infrastructure, or production-scale distributed rate limiting.
- Browser access to OpenAI credentials, provider response IDs, raw tool events, system instructions, or internal traces.

## Dependencies and assumptions

- Phase 4 remains the deployed behavioral baseline and its database confirmation transaction remains the only public request creator.
- BuildPro has active services and approved active knowledge documents.
- The official `openai` SDK is added as the only new production dependency after reviewing its locked version and transitive changes.
- Deployment secret management provides `OPENAI_API_KEY`; it never appears in `.env.example` as a value, logs, browser bundles, tool arguments, or database rows.
- AI is enabled only when an explicit server setting, valid key, reviewed model, and required limits are present. Missing AI configuration intentionally selects deterministic mode rather than failing the whole application build.
- Pilot language is English. Canonical intents/fields remain locale-independent.
- Recent transcript messages are adequate for Phase 5. A persisted rolling-summary schema is deferred unless measured context limits require it; no model-generated summary may replace structured draft data.
- Organization configuration in Phase 5 consists of allowlisted identity, active services, approved knowledge, supported language, and safe contact/handoff wording. It is not an arbitrary tenant-authored system prompt.
- Official Responses API features and model availability are reverified during implementation. Do not silently move model versions after tests/evaluations are approved.

## Design overview

```text
Public message route
  -> verify opaque conversation token and derive organization
  -> rate limit + validate client message ID/body
  -> persist/deduplicate customer message
  -> load bounded trusted context
  -> AI orchestrator (when enabled)
       -> Responses API
       -> validate requested tool
       -> execute application service with trusted context
       -> append structured tool result
       -> continue, bounded by tool-call limit
       -> validate final customer-safe response
  -> persist assistant response/state atomically where applicable
  -> deterministic fallback on disabled AI, refusal, invalid output, timeout, or provider failure
```

The route owns HTTP concerns only. The orchestrator owns provider sequencing, not business authorization. Tool executors own schema validation and service dispatch, not database queries. Application services remain the only mutation authority.

## Server-side Responses API integration

- Create a `server-only` OpenAI client factory under `lib/openai/` using `OPENAI_API_KEY` and a bounded request timeout/abort signal.
- Wrap the SDK behind a small `OpenAIResponsesClient` interface so tests use a fake adapter rather than network calls.
- Use `responses.create` with stable instructions, bounded input, the reviewed model, maximum output tokens, and strict function tools.
- Keep provider-specific response objects inside `lib/openai/`. Convert them to internal discriminated events such as `assistant_text`, `tool_calls`, `refusal`, `incomplete`, or `provider_error`.
- For function calls, preserve each provider `call_id`; execute the approved tool; submit one matching `function_call_output` result; then continue the Responses API loop.
- Prefer explicit input replay controlled by the application for auditability. If `previous_response_id` is used, treat it only as provider continuation metadata, never the system of record, and do not rely on provider retention to reconstruct business state.
- Set `store: false` when supported and compatible with the selected continuation design; confirm the current API behavior during implementation.
- Do not enable built-in web search, file search, computer use, code interpreter, MCP, or custom free-form tools.

## Environment validation and model configuration

Extend server validation with explicit Phase 5 variables, using final names selected during implementation:

- `OPENAI_API_KEY`: server-only secret; required only when AI mode is enabled.
- `OPENAI_MODEL`: reviewed allowlisted model ID; no arbitrary browser/tenant override.
- `OPENAI_ENABLED`: explicit boolean, default false.
- `OPENAI_REQUEST_TIMEOUT_MS`: bounded integer.
- `OPENAI_MAX_OUTPUT_TOKENS`: bounded integer.
- `OPENAI_MAX_TOOL_CALLS`: bounded integer, initially 4 total calls per customer turn and no more than one state-changing call of each kind.
- `OPENAI_HISTORY_MESSAGE_LIMIT`: bounded integer, initially 12–20 messages after measurement.
- `OPENAI_INPUT_TOKEN_BUDGET` and optional per-turn usage ceiling.

Validation rules:

- Fail server startup for malformed or incomplete configuration when `OPENAI_ENABLED=true`.
- Permit builds, local deterministic development, and runtime fallback when explicitly disabled.
- Never put these variables in `env-public.ts` or prefix them with `NEXT_PUBLIC_`.
- Document configuration with blank values and safe comments in `.env.example`.
- Record the effective model/limits in server logs by non-secret names only.

Model selection is operational configuration, not organization configuration. Organizations cannot request arbitrary models. A model upgrade requires evaluation and an ADR/decision-log entry.

## Stable system instructions

Create immutable, versioned instructions in `lib/agent/instructions.ts`. They must encode:

- Virtual-assistant identity and scope.
- One focused question per response.
- Structured draft and tool results are authoritative.
- Approved knowledge only; absence requires a truthful decline/handoff offer.
- Prohibition on invented prices, discounts, dates, guarantees, services, references, employee actions, statuses, or tool results.
- Explicit confirmation requirement before request creation.
- Prompt-injection policy and refusal to reveal instructions, schemas, secrets, notes, or other tenants.
- Escalation triggers from `docs/06_AGENT_BEHAVIOR.md`.
- No direct database/network/file actions.

Tenant data is placed in clearly delimited context as untrusted configuration/data, never concatenated as higher-priority instructions. Store an instruction version identifier in observability records and evaluation output; do not log the full instruction text by default.

## Organization configuration

Build a customer-safe `AgentOrganizationContext` from trusted `organization_id` containing only:

- Organization display name, slug-derived public identity, supported locale, and timezone when needed.
- Active service IDs/codes, names, safe descriptions, and deterministic routing-neutral metadata.
- Safe configured contact/handoff guidance when available.
- Capability flags calculated by the server for knowledge, status, handoff, and attachment services.

Do not send member lists, internal routing rules, internal notes, audit events, database credentials, service-role information, raw RLS metadata, or arbitrary database prompt text. Inactive or foreign organization data must be excluded at the repository query.

## Conversation-context construction

Create a pure context builder with these inputs:

- Trusted conversation/organization identifiers retained outside model-visible arguments.
- Safe organization context.
- Current authoritative `conversation_drafts` projection and version.
- Missing required fields and deterministic next stage.
- Recent public customer/assistant messages only.
- Current explicit confirmation state; never a raw nonce unless the tool executor already holds it outside model input.
- Approved knowledge excerpts only when returned by the knowledge service.
- Available tool names for this turn.

Exclude system/tool database messages, internal notes, employee-only data, raw token/nonce digests, customer records unrelated to this conversation, attachment storage paths, auth/session data, and other tenants.

### Conversation-history limits

- Load by `(organization_id, conversation_id)` with a fixed maximum and deterministic chronological ordering.
- Select the most recent messages that fit both a count limit and an estimated input-token budget.
- Always preserve the current user message and authoritative structured draft even when older messages are removed.
- Apply per-message and total-character bounds before token estimation.
- Never send more history merely because the browser requests it.
- If a rolling summary is later required, mark it as untrusted conversational context; never use it to restore confirmed fields or authorization.
- Add tests showing internal/tool messages and another tenant's messages cannot enter context.

## Structured confirmed fields

`conversation_drafts` remains the source of truth. The model may propose candidates, but:

- `save_conversation_fields` validates an allowlisted patch through the same field schemas/normalizers used by deterministic edits.
- The service uses optimistic draft versioning and returns a typed stale conflict.
- Confirmed phone ownership cannot be inferred from a phone string. Changing the phone clears confirmation and returns the deterministic confirmation question.
- Confirmed fields are not overwritten unless the current customer turn is classified as an explicit correction and the application service permits the change.
- Service IDs must resolve to an active service in the trusted organization; model-provided labels are mapped only through tenant-scoped configuration.
- Summary generation and confirmation nonce issuance remain server functions outside free-form model authority.

## Intent recognition and next-question selection

The model may return one supported intent candidate:

- `service_information`
- `quotation_request`
- `site_visit_request`
- `request_status`
- `complaint`
- `human_support`
- `unknown`

Validate it with a strict schema. Low confidence, conflicting signals, or `unknown` produces one deterministic clarification question. Explicit menu actions continue bypassing model classification.

After any saved field proposal, reload the authoritative draft and call the existing deterministic missing-field/next-stage logic. The model may phrase the selected question within tight constraints, but it cannot skip required fields, mark phone confirmation, enter review, or create a request by choosing a different question. When output validation fails, use `promptForStage` directly.

## Approved company knowledge retrieval

Add a read-only `KnowledgeService` and organization-scoped repository method that searches only:

- Active services for the trusted organization.
- `knowledge_documents` where `status='approved'`, approval metadata is valid, and the record belongs to the trusted organization.

Initial retrieval should use bounded normalized PostgreSQL text search or conservative token matching already supported by PostgreSQL. Add an extension only if measured need and migration review justify it. Return short excerpts, source IDs, document titles/types, and a deterministic found/not-found result. Do not return internal approval notes, storage paths, drafts, foreign content, or arbitrary URLs. The final answer must be checked against retrieved content; no result produces the approved “I do not have approved information” response and a human-support option.

## Tool registry and definitions

Define exactly these six names; reject all others before dispatch:

1. `search_company_information`
2. `save_conversation_fields`
3. `create_customer_request`
4. `get_request_status`
5. `request_human_support`
6. `attach_file_to_conversation`

Each registry entry includes a strict JSON-schema-compatible input definition, Zod input/output schemas, read/state-changing classification, availability predicate, maximum calls per turn, redaction policy, timeout, and executor binding. Use strict schemas with `additionalProperties: false` and required keys explicit. Do not expose organization ID, database credentials, role, SQL, URL, storage path, reference generator, or arbitrary metadata fields.

### Tool argument schemas

- `search_company_information`: `{ question, serviceCode? }`, bounded strings. Organization comes from trusted context.
- `save_conversation_fields`: `{ expectedDraftVersion, fields, fieldSources }`; `fields` is an allowlisted partial object. Conversation ID comes from trusted context, even if documentation retains it as a conceptual input.
- `create_customer_request`: `{ confirmation: true, idempotencyKey }`. The executor obtains conversation ID and a valid server-held confirmation nonce/receipt; no customer/request fields or reference are accepted.
- `get_request_status`: `{ referenceNumber, verificationToken }`. The trusted organization comes from context. Until Phase 8 exists, this tool is unavailable and cannot disclose status.
- `request_human_support`: `{ requestId?, reason, priority }`, with closed priority values and bounded reason. Conversation ID and organization come from context. Until a Phase 7 handoff service exists, return unavailable rather than insert directly.
- `attach_file_to_conversation`: `{ attachmentId }`. The service must verify that an already validated private attachment belongs to the same organization/conversation. Until Phase 6 exists, return unavailable; the model never receives upload/storage credentials.

Treat IDs and field values as untrusted even when emitted by the model. Reject extra fields and invalid enums, lengths, numbers, dates, UUIDs, references, and state transitions.

## Tool execution

Create a `ToolExecutor` that receives a trusted server context and validated tool call. It must:

1. Look up the exact allowlisted definition.
2. Verify that the capability is available for the current stage.
3. Parse arguments with the tool's Zod schema.
4. Ignore/reject any attempt to select organization or conversation scope.
5. Enforce per-turn call and mutation limits.
6. Dispatch to an application service, never a repository or Supabase/OpenAI client directly.
7. Return a small typed result with customer-safe codes.
8. Record sanitized tool metadata and duration.

State-changing service mapping:

- `save_conversation_fields` -> a refactored/reused `PublicConversationService` draft update operation.
- `create_customer_request` -> the existing confirmation application service/RPC with server-held nonce and idempotency.
- `request_human_support` -> future dedicated `HumanHandoffService`; unavailable until implemented safely.
- `attach_file_to_conversation` -> future dedicated `AttachmentService`; unavailable until Phase 6.

Read tools map to `KnowledgeService` and future verified `RequestStatusService`. No executor may instantiate an admin client and write tables directly.

## Tool-result continuation loop

The orchestrator runs a bounded loop:

1. Send validated context and currently available tools to Responses API.
2. If the response contains final text/refusal, validate and finish.
3. If it contains function calls, reject duplicate/unknown/excess calls.
4. Validate and execute calls sequentially by default so state changes have deterministic ordering.
5. Append one structured `function_call_output` per provider `call_id`.
6. Continue with the provider using the returned outputs.
7. Stop after the configured maximum, on repeated identical calls, after request creation, or after any terminal security failure.
8. Produce a deterministic safe response when the loop cannot finish.

Initially allow at most four total calls and at most one mutation call for `create_customer_request`, `request_human_support`, or attachment association per customer turn. A second identical read may use the cached result; a repeated state mutation is rejected or idempotently replayed through its service.

## Idempotency and duplicate handling

- Continue using browser `clientMessageId` as the message-turn idempotency key.
- Persist the customer message exactly once before any provider call.
- Store a turn record or equivalent durable metadata keyed by `(organization_id, conversation_id, client_message_id)` with state such as `received`, `processing`, `completed`, or `fallback_completed` if needed for crash-safe retries.
- Derive stable per-tool idempotency keys from the trusted turn ID, tool name, and operation ordinal using a server secret/HMAC or persist a generated UUID before execution. Never accept a model-generated request idempotency key as authority.
- Duplicate HTTP retries return the existing committed assistant/tool outcome and do not call OpenAI or a mutation service again.
- Request creation remains additionally protected by the existing conversation lock, confirmation receipt, and database uniqueness.
- A provider timeout after a successful tool mutation must recover the stored tool result and produce a deterministic final response; it must never rerun the mutation merely because final prose was missing.

## Prompt-injection resistance

- Keep system instructions server-owned and higher priority than customer/configuration/knowledge text.
- Mark messages, tenant content, document excerpts, filenames, and tool results as data, never instructions.
- Do not send internal prompts or tool schemas back through public errors.
- Expose no arbitrary SQL, URL fetch, shell, code, filesystem, web-search, or credential-bearing tool.
- Resolve all tenant and authorization scope outside model arguments.
- Require backend verification for every identifier and state change.
- Detect requests to reveal prompts, tools, secrets, notes, other customers, or bypass confirmation and return a stable refusal/handoff path.
- Treat retrieved documents containing instruction-like text as untrusted evidence and retain source boundaries.
- Add adversarial tests for direct injection, indirect injection inside knowledge, fake tool-result text, cross-tenant requests, and attempts to make the model invent successful operations.

Prompt-injection checks are defense in depth; authorization and tenant isolation must remain correct even if the model follows malicious text.

## Model-output validation and forbidden claims

- Parse provider events structurally; never infer tool calls from prose.
- Validate all tool arguments and outputs against independent schemas.
- Bound final text length and require a customer-safe shape or policy result.
- Run a deterministic post-check for references, currency/price claims, dates/promises, unsupported services, employee-action claims, prompt/schema disclosures, and raw internal identifiers.
- Permit a request reference/status only when it exactly matches a successful tool result from the current/recovered turn.
- Permit company facts only when supported by current approved retrieval results or fixed organization identity.
- A policy violation replaces the text with a deterministic safe response and records a redacted validation outcome; it never attempts to “repair” dangerous claims by trusting another unconstrained model call.

Forbidden-claim checks must include semantic evaluation fixtures, not rely solely on regex. Regex/allowlists remain useful for exact references, currency patterns, identifiers, and secret markers.

## AI provider failures and deterministic fallback

Normalize provider failures to internal categories: timeout, authentication/configuration, rate limit, unavailable, invalid response, refusal, context limit, and unknown external error. Public responses use `external_service_error` or a deterministic successful fallback without provider details.

For every failure:

- Keep the already-persisted customer message.
- Do not discard validated draft changes already committed by tools.
- Do not invent a tool result or reference.
- Reload authoritative draft state.
- Return the exact deterministic next question/menu/summary behavior from Phase 4 where possible.
- Offer truthful human guidance for unsupported knowledge or terminal provider failure.
- Ensure retries reuse the same turn/idempotency state.

AI-disabled mode must exercise the same route and service contract while selecting the deterministic processor before constructing an OpenAI client.

## Observability

Record one structured server event/metric per turn and tool execution containing only:

- Trace ID, pseudonymous conversation/turn identifier, trusted organization ID, endpoint, instruction version, model, attempt count, duration, outcome, fallback reason, tool name, tool result code, provider request ID when safe, and input/output/cached token usage when returned.
- Estimated cost may be calculated only from a versioned server-owned price table and labeled unavailable when pricing is not configured; never invent current pricing.

Do not log full messages, phone/email, knowledge content, file contents/paths, raw prompt, raw token/nonce, API key, service-role key, session cookie, tool arguments containing PII, or full provider payloads by default. Apply field-level redaction before the logger call. Observability failures must not break customer request capture.

## Token and cost controls

- Enforce per-message input length before provider invocation.
- Cap history by count and token estimate.
- Cap knowledge excerpts by count, characters, and tokens.
- Cap output tokens and tool-loop iterations.
- Use the smallest reviewed model/configuration that passes the evaluation threshold; keep the initial model configurable.
- Record actual provider usage when returned and establish per-turn/per-organization warning ceilings.
- Rate-limit expensive AI processing independently from normal deterministic messaging so abuse does not disable the fallback path.
- Do not automatically retry non-transient errors. Use at most one bounded retry for clearly transient pre-mutation failures with jitter and the same turn identity.
- Evaluate prompt caching only after correctness and privacy review; do not include volatile secrets or cross-tenant content in reusable cache prefixes.

## API and UI behavior

- Extend `POST /api/conversations/{conversationId}/messages` with a strict `{ clientMessageId, kind: "message", message }` variant.
- Preserve all Phase 4 action/answer/skip/cancel variants unchanged.
- Resolve token/organization and apply rate limiting before orchestration.
- Return the existing customer-safe conversation DTO plus an optional non-sensitive processing/fallback indicator if the UI needs it.
- Show a bounded loading state while AI runs and a neutral deterministic fallback on timeout.
- Never return provider response IDs, model reasoning, tool calls/results, prompt text, usage cost, or internal errors to the browser.
- Explicit menu controls remain available so the customer can continue without AI.

## Database changes

Prefer no schema change unless crash-safe turn recovery cannot be represented by current message metadata. If required, add one additive migration for a tenant-owned `agent_turns`/`agent_tool_events` table with:

- `organization_id`, conversation/message composite foreign keys, unique turn/client-message identity, instruction/model identifiers, status, sanitized tool names/result codes, provider request ID if retained, token counts, timings, created/updated timestamps, and no raw secrets/prompts/tool arguments.
- Immutable organization scope, checks, indexes for active/retry lookup and retention, forced RLS, no anonymous/authenticated table writes, and service-role-only controlled access.

The migration must be version-controlled, reset-safe, tested, and additive. Do not store chain-of-thought/reasoning. Define retention before production. A failed AI turn must not delete messages or drafts. Rollback disables AI reads/writes first; dropping operational records requires a separately reviewed later migration.

## Milestones

1. **Foundation:** finalize model/SDK compatibility, environment validation, provider interface, stable instruction version, schemas, context DTOs, and deterministic disabled mode.
2. **Read-only intelligence:** implement tenant-scoped knowledge service, bounded context builder, intent recognition, next-question proposal, output validation, and mocked provider tests.
3. **Controlled tools:** implement exact tool registry, service-only executor, save-fields/request-creation adapters, bounded continuation loop, idempotent turn recovery, and unavailable capability results for later-phase tools.
4. **Integration and hardening:** integrate the natural-language message variant/UI fallback, add observability/cost controls, adversarial/evaluation suites, database and E2E regressions, documentation, and final security review.

Each milestone must leave structured Phase 4 messaging functional with AI disabled.

## Expected file changes

Files likely to create:

```text
lib/agent/instructions.ts
lib/agent/types.ts
lib/agent/conversation-context.ts
lib/agent/context-budget.ts
lib/agent/tool-definitions.ts
lib/agent/tool-schemas.ts
lib/agent/tool-executor.ts
lib/agent/orchestrator.ts
lib/agent/output-validation.ts
lib/agent/safety.ts
lib/agent/observability.ts
lib/openai/client.ts
lib/openai/responses-client.ts
lib/openai/errors.ts
lib/repositories/knowledge-repository.ts
lib/repositories/supabase-knowledge-repository.ts
lib/services/knowledge-service.ts
lib/services/agent-runtime.ts
tests/unit/agent/*.test.ts
tests/unit/openai/*.test.ts
tests/fixtures/agent-evaluations/*.json
scripts/test-agent-routes.mjs
scripts/run-agent-evaluations.mjs
```

Files likely to modify:

```text
.env.example
package.json
package-lock.json
lib/config/env-schema.ts
lib/config/env-server.ts
lib/schemas/public-conversation-api.ts
lib/services/public-conversation-service.ts
lib/repositories/public-conversation-repository.ts
lib/repositories/supabase-public-conversation-repository.ts
app/api/conversations/[conversationId]/messages/route.ts
components/chat/public-chat.tsx
docs/04_ARCHITECTURE.md
docs/06_AGENT_BEHAVIOR.md
docs/07_API_CONTRACTS.md
docs/11_DECISIONS.md
PROJECT_TREE.txt
```

Conditional files, only if durable turn recovery needs schema support:

```text
supabase/migrations/<timestamp>_phase_5_agent_turns.sql
supabase/tests/<next>_agent_turns_security.sql
lib/supabase/database.types.ts
```

Do not modify Phase 4 migrations already applied; hardening uses additive migrations.

## Commands to run during implementation

Confirm actual scripts before use. Expected sequence:

```bash
npm install openai@<reviewed-version>
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

If a migration is required:

```bash
npm run db:reset
npm run db:types
npm run db:types:check
npm run db:lint
npm run db:test
```

Run mocked tests without an API key. A real-provider smoke/evaluation run must be a separate opt-in command, use a development OpenAI project with spend limits, contain no real customer data, and never be required for normal CI.

## Test plan

### Unit tests

- Environment matrix: disabled/no key succeeds; enabled/missing key or model fails; malformed limits fail; secrets never appear in public environment.
- Stable instruction snapshot/version and absence of tenant-authored high-priority instructions.
- Context selection order, count/token truncation, required current turn/draft retention, and exclusion of internal/foreign data.
- Supported/unknown intent schema and low-confidence clarification.
- Shared field normalization, correction protection, phone reconfirmation, and deterministic next-question selection.
- Every tool's strict argument/result schema, extra-key rejection, lengths/enums/UUIDs/dates/budgets, and unavailable capability result.
- Unknown tool, duplicate mutation, repeated identical call, and maximum-call rejection.
- Output policy checks for prices, dates, references, services, employee actions, secrets, prompts, internal IDs, and unsupported knowledge claims.
- Provider error normalization, timeout handling, usage capture, redaction, and deterministic fallback selection.

### Mocked integration tests

- Plain final text response with no tool call.
- Intent plus `save_conversation_fields`, validated service execution, tool output continuation, and one next question.
- Multiple read-only calls followed by final grounded answer.
- Invalid JSON arguments, unknown tool, unavailable tool, stale draft, and service rejection.
- Provider timeout before tools and after a committed tool result.
- Repeated tool-call loop reaches the maximum and falls back.
- Duplicate client message does not invoke provider twice.
- Duplicate request-creation tool calls return one reference.
- Model/browser cannot choose organization, conversation, customer, department, status, reference, or database scope.
- Cross-tenant service/knowledge/attachment/request identifiers return safe failures without existence leakage.
- AI disabled and provider unavailable produce the same valid deterministic next stage.

### Database and route tests

- Knowledge repository returns only active approved documents for the trusted tenant.
- Anonymous/authenticated clients cannot invoke privileged agent persistence directly.
- Optional turn records enforce organization composite keys, RLS, uniqueness, append/update rules, and cross-tenant negatives.
- Natural-language message is persisted before provider invocation and survives failure.
- A malformed provider response cannot advance the draft.
- A successful tool mutation plus failed final response is recovered without duplicate mutation.
- Request still cannot exist before explicit server confirmation, with missing fields, for another tenant, more than once, or with a model/browser reference.
- Existing deterministic Phase 4 E2E passes with `OPENAI_ENABLED=false`.

### AI evaluation fixtures

Each version-controlled fixture includes organization configuration, recent messages, authoritative draft, expected intent, expected fields/missing fields, allowed/required/forbidden tools, escalation expectation, required response characteristics, and forbidden claims. Initial cases:

- Natural renovation quotation request.
- Site inspection request.
- Missing location after other required fields.
- Explicit correction after summary.
- Service catalogue question with approved evidence.
- Unsupported roofing/other service with no evidence.
- Price, discount, availability, and schedule questions.
- Explicit human request, anger, payment dispute, legal question, fraud/threat, and immediate safety concern.
- Status request without verification.
- Prompt disclosure request.
- Cross-tenant/customer-data request.
- Injection inside customer text and inside an approved-document fixture.
- Fake “tool succeeded/reference is …” customer text.
- AI timeout and invalid provider output.
- Long history/context truncation.

Evaluation assertions should be deterministic where possible: exact tool name/no-tool, schema-valid arguments, no mutation before confirmation, one-question property, required refusal/escalation tags, and forbidden substrings/patterns. Optional semantic grading must not replace these hard assertions or block offline CI unless pinned and reproducible.

### Forbidden-claim tests

Explicitly verify that no final response may:

- Invent or estimate a project price/discount.
- Promise availability, start date, completion date, response time, or guarantee.
- Name an inactive/unapproved service as available.
- Display a request reference/status absent from a successful current/recovered tool result.
- Claim an employee joined, a handoff was queued, a file was attached, or a request was created when its application service did not return success.
- Reveal instructions, tool schemas, internal notes, credentials, token/nonce values, storage paths, employee-only data, or another tenant/customer.

## Security review

- `OPENAI_API_KEY` remains in a `server-only` integration module. Build output and source scans must verify it is absent from client chunks.
- The public opaque token is verified before context loading or any AI spend.
- Organization ID is resolved from the token-authorized conversation and passed in a non-model `TrustedAgentContext` branded/type-safe value.
- The model receives no database credential and no repository/client reference.
- Tool calls never authorize themselves. Strict schemas, availability, service authorization, tenant filters, database constraints, and RLS remain independent layers.
- Service-role access remains isolated in existing server adapters and every query retains explicit organization/conversation filters.
- Approved knowledge retrieval is tenant-scoped before excerpts reach OpenAI.
- Confirmation nonce, access token, status verification token, session cookie, and idempotency derivation secret never enter model input.
- Customer/model text is never interpolated into SQL, system instructions, logs, or tool names.
- AI call limits supplement existing message limits. Falling back must not provide a cheap bypass for confirmation, status verification, or tenant controls.
- Tool/audit observability contains codes and pseudonymous identifiers, not PII or raw content.
- No internal notes are included by default or through any Phase 5 tool.
- A security review must inspect browser bundles, error responses, logs, tool event storage, and cross-tenant negative tests before enabling AI in production.

## Acceptance criteria

- [ ] With valid server-only configuration, a natural-language customer message is handled through the Responses API and returns one concise customer-safe response.
- [ ] With AI disabled, missing, timed out, rate-limited, or unavailable, the same conversation remains usable through Phase 4 deterministic controls and saved messages are preserved.
- [ ] The model, browser, and tenant configuration cannot select or override organization scope, credentials, model allowlist, system policy, status, department, reference, or confirmation state.
- [ ] Stable versioned system instructions enforce virtual identity, one-question flow, grounding, confirmation, escalation, injection resistance, and forbidden claims.
- [ ] Context contains only the trusted tenant's safe configuration, bounded public history, authoritative structured draft, and approved retrieval results.
- [ ] History and knowledge respect configured count/token budgets; long conversations cannot create unbounded requests.
- [ ] Supported intent candidates and field proposals are schema-validated; low confidence uses deterministic clarification.
- [ ] Draft updates use existing schemas/services, preserve version conflicts, and cannot overwrite confirmed fields silently.
- [ ] Next required question is selected from authoritative deterministic state after every tool result.
- [ ] Company answers are grounded only in active approved same-tenant content; missing evidence yields a truthful decline/handoff offer.
- [ ] Exactly the six named tools exist in the registry, and only safely implemented capabilities are exposed per turn.
- [ ] Every tool argument/result is strictly validated and every state change calls an application service.
- [ ] No model path directly accesses Supabase, SQL, storage, credentials, arbitrary URLs, code, or filesystem operations.
- [ ] The continuation loop correlates tool results by call ID, executes mutations deterministically, and stops at the configured maximum/repetition/terminal outcome.
- [ ] Duplicate HTTP messages and tool calls do not repeat provider spend or state changes; request retries return the same backend-generated reference.
- [ ] Request creation remains impossible before explicit confirmation, with missing fields, for another organization, more than once, or with a model/browser-generated reference.
- [ ] Status remains undisclosed without Phase 8 verification; attachment and handoff tools cannot fabricate unavailable later-phase operations.
- [ ] Prompt injection and indirect knowledge injection cannot reveal protected data or cause an unauthorized tool success.
- [ ] Final model text is validated; forbidden prices, dates, guarantees, references, services, tool results, and disclosures are replaced by deterministic safe output.
- [ ] Observability captures trace/model/tool/outcome/usage metadata with PII and secrets redacted.
- [ ] Unit, mocked integration, database/RLS, cross-tenant, E2E, evaluation, forbidden-claim, lint, formatting, strict typecheck, build, and secret/client-bundle checks pass.
- [ ] No Phase 6 attachment upload, Phase 7 full handoff, Phase 8 status verification, or later feature is implemented.

## Progress log

- [x] Verify and read `AGENTS.md`, `.agent/PLANS.md`, and every document requested for Phase 5 planning.
- [x] Read `docs/00_INDEX.md` because repository instructions require it.
- [x] Inspect the current package scripts/dependencies, environment validation, public APIs/UI, deterministic workflow, repositories/services, migrations, database types, and Phase 4 tests.
- [x] Verify that no OpenAI SDK, client, agent layer, or model call currently exists.
- [x] Reconcile the six documented tools with implemented Phase 4 services and later-phase capability boundaries.
- [x] Review current official OpenAI Responses/function-calling guidance and resolve the current recommended model for planning; implementation must reverify it.
- [x] Create the Phase 5 execution plan only.
- [x] Review and approve this plan before implementation.
- [x] Milestone 1: provider/configuration/context foundation.
- [x] Milestone 2: read-only intelligence and output validation.
- [x] Milestone 3: controlled tool execution and durable idempotency.
- [x] Milestone 4: route/UI integration, evaluations, security hardening, and documentation.
- [x] Run all acceptance checks and record exact results.

## Decision log

- 2026-08-10: Phase 5 augments rather than replaces Phase 4. The deterministic state machine, draft, summary nonce, confirmation transaction, and backend reference allocator remain authoritative.
- 2026-08-10: Use the OpenAI Responses API behind a server-only adapter. The model receives controlled function schemas but never database/storage/provider credentials or application clients.
- 2026-08-10: Stable policy instructions live in version-controlled code. Tenant content is delimited data and cannot override system policy.
- 2026-08-10: Organization and conversation scope are resolved from the opaque-token request context and are not accepted from model tool arguments.
- 2026-08-10: The registry contains only the six documented tools. Per-turn exposure is capability-gated; Phase 6–8 tools must report unavailable until their services exist and cannot be simulated with direct repository writes.
- 2026-08-10: Tool execution is sequential and capped initially at four calls per turn, with stricter per-mutation limits and repetition detection.
- 2026-08-10: Structured database draft fields override transcript/model summaries. A model output is always a proposal until schema and service validation succeed.
- 2026-08-10: Initial knowledge retrieval uses bounded same-tenant approved PostgreSQL content. Vector retrieval is deferred until measured quality justifies its security and operational cost.
- 2026-08-10: AI configuration is explicitly disableable. Missing/unavailable OpenAI service selects the deterministic flow instead of blocking request capture.
- 2026-08-10: Model IDs are reviewed operational configuration. `gpt-5.6-sol` was the current resolver result during planning, but no model is silently upgraded without evaluations.

## Known risks and limitations

- Three allowlisted tools depend on later phases. Status cannot be returned before verified second-factor services, attachments cannot be associated before validated private upload lifecycle, and a handoff cannot be claimed before a dedicated audited service exists.
- Natural-language extraction can be wrong. Schema validation and customer-visible correction reduce risk but do not make model candidates authoritative.
- Regex/allowlist output filters cannot prove semantic safety. Versioned adversarial evaluations and application-service authorization remain necessary.
- PostgreSQL keyword search may miss paraphrases. This is safer than premature broad retrieval; measure failures before adding embeddings/vector search.
- Provider latency and availability may degrade the natural-language experience. Deterministic controls must remain visible and independently rate-limited.
- Pricing and model availability change. Cost estimates need a maintained server-owned price configuration and must never be presented as current without review.
- Persisting provider response IDs or usage metadata creates retention/privacy obligations. Minimize fields and define retention before production.
- The plan does not resolve production conversation/log retention, which remains an existing privacy decision required before real customer deployment.
- A single public browser conversation cookie remains a Phase 4 limitation.

## Completion notes

Implemented on 2026-08-10. Phase 5 adds the official OpenAI JavaScript SDK and a `server-only` Responses API adapter, explicit disabled/enabled environment configuration, stable versioned instructions, bounded tenant-safe context, the exact six-tool registry with strict Zod validation, service-dispatched field saving, tenant-scoped approved knowledge search, bounded tool-result continuation, timeout/provider fallback, prompt-injection and forbidden-claim controls, natural-language chat UI/API support, duplicate exchange recovery, mocked integration tests, and a 12-case behavior evaluation dataset.

Implementation deliberately exposes no later-phase success path: `get_request_status`, `request_human_support`, and `attach_file_to_conversation` validate their arguments but return `capability_unavailable` until Phases 6–8 provide their dedicated secure application services. Request creation continues through the Phase 4 server summary, nonce, explicit browser confirmation, and transaction; the model cannot create or supply a reference. No Phase 6 behavior was implemented.

Final verification:

- `npm run format:check` passed.
- `npm run lint` passed with no warnings.
- `npm run typecheck` passed under strict TypeScript.
- `npm test` passed: 19 files and 71 tests.
- `npm run test:ai` passed: 4 files and 20 mocked/evaluation tests, including all 12 required behavior fixtures.
- `npm run build` passed with the OpenAI key absent from browser configuration.
- `npm run db:reset` passed all seven migrations and the production-safe seed.
- `npm run db:lint` passed with no schema errors.
- `npm run db:test` passed 108 pgTAP assertions, 20 concurrent references, 12 Auth/RLS checks, 9 protected-route checks, 29 request-route checks, and the public conversation E2E journey including natural-language injection and duplicate replay.
- `git diff --check` passed.

No live OpenAI request was made because no development API credential was provided; provider behavior is covered through the mocked adapter. Before hosted enablement, configure a server-only key, confirm the reviewed model is available to that OpenAI project, set spend/rate limits, and run an opt-in synthetic smoke test containing no real customer data.

### Post-audit hardening

The 2026-08-10 security audit identified gaps between the initial implementation and this plan. The corrective pass:

- changed stateless Responses tool continuation to replay returned output items with function results instead of referencing an unstored response;
- made provider function definitions strict-compatible while retaining independent strict Zod validation;
- exposes only the currently executable knowledge and draft tools to the model while retaining the exact six-name defensive registry;
- added current-turn tool-result provenance checks for company facts, references, prices, and claimed actions;
- requires deterministic explicit-correction language and matching `fieldSources` before replacing populated draft fields;
- revalidates opaque conversation access immediately before a model-directed draft mutation;
- converts stale incomplete turns to one persisted deterministic fallback rather than invoking the provider or mutations again;
- budgets the complete serialized context and removes duplicate inclusion of the current customer message;
- records redacted per-turn trace, usage, duration, tool-name, outcome, and fallback metadata without message bodies, contact data, prompts, arguments, or credentials; and
- expanded adversarial, strict-tool, stateless-continuation, provenance, and context-budget tests.

No attachment, human-handoff, request-status, or Phase 6 capability was enabled by this hardening pass.

Post-audit verification passed: formatting, lint, strict typecheck, 20 Vitest files/79 tests, 5 AI test files/28 tests including 17 behavior fixtures, production build, database reset, schema lint, 108 pgTAP assertions, 20-reference concurrency, 12 Auth/RLS checks, 9 protected-route checks, 29 request-route checks, and the public-conversation E2E journey. The browser-bundle scan found no OpenAI key marker and `git diff --check` passed.

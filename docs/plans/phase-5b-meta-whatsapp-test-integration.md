# Plan: Phase 5b Meta WhatsApp Test Integration

## Goal

Connect Meta's WhatsApp Cloud API test environment to SmartDesk AI so that an authorized test recipient can message Meta's test WhatsApp number, have the inbound text stored in the existing tenant-scoped conversation history, pass through the existing Phase 5 agent/application-service path, and receive the persisted assistant reply through WhatsApp.

Phase 5b is complete only when organization scope is resolved from server-owned WhatsApp phone-number configuration, authentic Meta webhook deliveries are accepted and deduplicated, inbound content is committed before OpenAI processing, retries cannot repeat conversation mutations or outbound sends, and Meta/OpenAI failures preserve recoverable state. This phase does not configure a production business number and does not create a second AI agent.

## User value

BuildPro can validate the same SmartDesk quotation-intake experience through a real WhatsApp test number. Customers keep one channel conversation, and employees see requests created through the existing confirmed-draft transaction rather than a parallel WhatsApp-only workflow.

## Current repository state

Inspection on 2026-08-10 found:

- Next.js 16.3, strict TypeScript, Zod, Vitest, Supabase, the official OpenAI SDK, environment validation, linting, formatting, build scripts, database reset/lint/pgTAP tests, and route-level integration scripts are present.
- Phase 4 provides deterministic public conversation state, server-stored drafts, explicit summary confirmation, confirmation nonce protection, idempotent request creation, backend reference allocation, and rate limiting.
- Phase 5 adds a server-only Responses API adapter, one shared `AgentOrchestrator`, bounded public history, stable instructions, tenant-scoped approved knowledge, strict tool validation, and deterministic fallback.
- The web route authorizes a conversation through an opaque cookie and then calls `PublicConversationService`. The current repository and service interfaces are web-token-oriented and need a small channel-neutral boundary before WhatsApp can reuse them safely.
- Natural-language web messages are persisted in `messages` before the OpenAI call. `client_message_id` is a UUID and is unique per organization/conversation. Assistant replies are linked through `reply_to_message_id`.
- `conversations.channel` has a database check that permits only `web`; there is no WhatsApp account configuration, external identity, channel-conversation link, provider event/message ID, delivery status, webhook route, or Meta client.
- `customers` already supports tenant-scoped phone matching, but phone is not unique and cannot by itself safely represent a provider identity.
- `messages.metadata` exists but is not an adequate sole deduplication mechanism because JSON metadata has no provider-ID uniqueness constraint and should not hold raw webhook payloads.
- The service-role client is server-only. Existing public tables use `organization_id`, composite tenant foreign keys, forced RLS, and restricted grants.
- Phase 5 deliberately leaves full attachment, human-handoff, and verified request-status services unavailable. Phase 5b must not claim those capabilities through WhatsApp.
- The working tree contains accumulated Phase 3 through Phase 5 changes. Implementation must preserve them and review only Phase 5b-related changes.

## Documentation reconciliation

No contradiction blocks planning:

1. `AGENTS.md` and the product requirements exclude **production** WhatsApp from the MVP. This plan is explicitly limited to Meta's developer test number and authorized test recipients, so it does not cross that boundary.
2. `docs/07_API_CONTRACTS.md` labels `/api/webhooks/whatsapp` as a placeholder and already requires signature verification, provider-message deduplication, configured phone-number tenant resolution, minimal metadata, and asynchronous processing where appropriate. Phase 5b makes only that test endpoint concrete.
3. Phase 5's public flow uses a browser confirmation nonce. WhatsApp has no browser cookie or button contract, so implementation must add a channel-neutral explicit-confirmation application operation backed by the same stored draft and existing `confirm_public_request` RPC. It may not accept draft fields or a reference from WhatsApp/model content.
4. Meta Portal labels and Graph API versions change. The implementation must use the current version shown in Meta's generated API example, store it as reviewed server configuration, and re-check the portal labels at implementation time rather than silently hard-coding an old version.

## Scope

- A Meta Developer App in development mode with the WhatsApp product.
- Meta-provided test WhatsApp number and one or more portal-authorized test recipient numbers.
- Temporary development access token stored only in local/deployment secrets.
- A public HTTPS `GET`/`POST /api/webhooks/whatsapp` route.
- Verification-token handshake and raw-body `X-Hub-Signature-256` validation using the Meta App Secret.
- Strict Zod parsing of the supported WhatsApp webhook envelope and text-message subtype.
- Trusted mapping from Meta `phone_number_id` to BuildPro's organization.
- Tenant-scoped WhatsApp identity and conversation mapping.
- Durable provider event/message deduplication and outbound delivery tracking.
- Inbound text persistence before agent execution.
- Reuse of the Phase 5 orchestrator, deterministic fallback, structured draft, application services, and existing confirmation/request transaction.
- Outbound text sends through a small server-only Meta Graph API client.
- Bounded conversation history using the same context builder and authoritative draft.
- Retry/recovery states, rate limiting, customer-safe failures, trace IDs, and redacted logs.
- Unit, pgTAP/RLS, mocked route/integration, and manual Meta test coverage.
- Documentation, database types, `.env.example`, scripts, and plan updates required by the implementation.

## Out of scope

- A production WhatsApp Business phone number, business verification, App Review, advanced access, production token/system-user rollout, billing, templates for production-initiated messaging, campaigns, or marketing.
- Supporting unapproved recipients in Meta's test environment.
- A WhatsApp-specific prompt, agent, tool registry, draft state machine, customer-request creator, reference allocator, or business workflow.
- Multiple AI agents or channel-dependent business rules.
- Voice notes, calls, reactions, stickers, contacts, locations, interactive lists/buttons, message edits, or arbitrary media processing.
- Complete attachment upload/scan/storage, human-handoff fulfillment, or verified request-status disclosure; their current capability restrictions remain.
- Guaranteed background-job infrastructure. The initial pilot may use a bounded post-persistence processing attempt plus a recoverable worker command/endpoint, but it must never acknowledge an unstored message.
- Phase 6 work.

## Dependencies and assumptions

- The Phase 4 confirmation RPC remains the only request-creation transaction and Phase 5 remains the only agent orchestration implementation.
- BuildPro's organization row and production-safe seed exist.
- A developer-controlled HTTPS URL can reach the Next.js webhook route. For local testing, use a reputable HTTPS tunnel whose random URL is treated as temporary; do not commit it.
- The person performing Meta setup has a Meta account with developer access and a phone running WhatsApp that can receive Meta's recipient-verification code.
- Meta supplies the test phone number, WhatsApp Business Account ID, phone-number ID, and temporary token on the app's WhatsApp API Setup page.
- Test-recipient identity is the normalized E.164 phone number/WhatsApp ID Meta supplies in the signed webhook. The customer must still explicitly confirm the contact number before request creation; channel possession is useful evidence but is not silently converted into confirmation.
- Initially accept inbound `text` messages only. Unsupported message types are recorded as a safe unsupported event and receive at most one explanatory response without passing binary data to OpenAI.
- Outbound free-form replies are sent only inside Meta's customer-service window opened by the inbound test message. Template-message initiation is out of scope.
- No Meta secrets are needed to write or review this plan. During implementation the user must configure them directly in local/deployment secret storage, not paste them into chat or commit them.

## Architecture and data flow

```text
Authorized test phone
  -> Meta test WhatsApp number
  -> signed Meta webhook
  -> GET/POST /api/webhooks/whatsapp
       -> raw-body signature and envelope validation
       -> trusted phone_number_id -> organization configuration
       -> WhatsApp channel application service
       -> transaction: deduplicate + resolve identity/conversation + store inbound message
       -> existing SmartDesk AgentOrchestrator
       -> existing draft/application services and deterministic fallback
       -> store assistant reply/outbound delivery intent
       -> server-only Meta Graph API client
       -> record provider wamid / delivery result
  -> authorized test phone
```

The webhook adapter translates Meta transport data into a channel-neutral inbound message command. It never calls OpenAI, Supabase tables, or request creation directly. The channel service coordinates a repository, the existing conversation/agent service, and a Meta sender. Shared business logic must be extracted from the web-token-specific methods only as far as necessary; the web cookie and Meta signature remain separate authentication adapters.

## Proposed database changes

Create one additive Phase 5b migration; do not edit applied migrations.

### `whatsapp_accounts`

Trusted tenant/channel configuration:

- `id uuid primary key`
- `organization_id uuid not null`
- `phone_number_id text not null`
- `whatsapp_business_account_id text not null`
- `display_phone_number text` for display only
- `is_test boolean not null default true` with Phase 5b check requiring true
- `is_active boolean not null default true`
- timestamps
- unique `(organization_id, id)`
- globally unique `phone_number_id`; a Meta destination must resolve to exactly one tenant
- unique `(organization_id, whatsapp_business_account_id, phone_number_id)`
- composite organization foreign key with `on delete restrict`

Do not store the access token, app secret, or verify token in this table.

### `whatsapp_identities`

Maps a Meta sender to a SmartDesk customer inside one tenant:

- `id uuid primary key`
- `organization_id uuid not null`
- `whatsapp_account_id uuid not null`
- `wa_id text not null` (normalized provider identity)
- `customer_id uuid not null`
- optional bounded `profile_name` treated as untrusted display data
- timestamps
- unique `(organization_id, id)`
- unique `(whatsapp_account_id, wa_id)`
- composite tenant foreign keys to account and customer, `on delete restrict`

Customer matching occurs in a transaction: lock/select an existing identity first; otherwise normalize the provider phone, reuse only an unambiguous same-tenant phone match, or create a minimal customer and identity. Never merge across organizations or solely by an unverified profile name.

### `whatsapp_conversations`

Maps a provider identity/account pair to the active SmartDesk conversation:

- `id uuid primary key`
- `organization_id uuid not null`
- `whatsapp_account_id uuid not null`
- `whatsapp_identity_id uuid not null`
- `conversation_id uuid not null`
- `state text` limited to `active` or `closed`
- timestamps
- unique `(organization_id, id)`
- one active mapping per `(whatsapp_account_id, whatsapp_identity_id)` using a partial unique index
- unique `(organization_id, conversation_id)`
- composite tenant foreign keys to all parents, `on delete restrict`

Create conversations with `channel='whatsapp'` and the mapped customer. Extend the existing channel check from only `web` to `web|whatsapp` in the additive migration.

### `whatsapp_message_deliveries`

Durable inbox/outbox and deduplication record:

- `id uuid primary key`
- `organization_id uuid not null`
- `whatsapp_account_id uuid not null`
- `whatsapp_identity_id uuid`
- `conversation_id uuid`
- `message_id uuid` linking the canonical SmartDesk `messages` row when available
- `direction text` limited to `inbound|outbound`
- `provider_message_id text not null`
- `provider_timestamp timestamptz`
- `status text` limited to `received|processing|processed|queued|sent|delivered|read|failed|unsupported`
- `attempt_count integer` with a small nonnegative bound
- `next_attempt_at timestamptz`
- `last_error_code text` from a bounded allowlist or sanitized code
- `trace_id uuid not null`
- timestamps
- unique `(whatsapp_account_id, provider_message_id)` for inbound and returned outbound `wamid` values
- composite tenant foreign keys, `on delete restrict`
- indexes for `(organization_id,status,next_attempt_at)`, conversation chronology, and provider lookup

Do not store the whole webhook, authorization headers, signature, access token, message body duplicate, or OpenAI payload. Canonical customer/assistant content remains in `messages`; the delivery row holds minimal operational metadata.

### Transaction functions

Add service-role-only, `security definer`, fixed-`search_path` functions as needed:

1. `ingest_whatsapp_text_message(...)` accepts already signature-verified, schema-validated provider fields plus trusted account ID. It locks the account/identity mapping, inserts or resolves the same-tenant customer and active WhatsApp conversation, inserts the inbound delivery with provider-ID uniqueness, inserts the canonical customer message, and returns `created|duplicate|in_progress|completed` plus IDs. The whole transaction commits before agent processing.
2. `claim_whatsapp_delivery(...)` atomically moves eligible `received`/retryable rows to `processing` with an attempt lease so concurrent webhook retries have one processor.
3. `complete_whatsapp_agent_turn(...)` inserts exactly one assistant reply linked to the inbound message and creates one outbound delivery intent. It uses uniqueness constraints so recovery returns the existing reply instead of generating another.
4. A small status-update function may record Meta outbound status webhooks monotonically without letting a late `sent` event downgrade `delivered` or `read`.

All functions reject inactive/mismatched accounts, immutable organization/provider IDs, oversized content, and cross-tenant links. Revoke execution from `public`, `anon`, and `authenticated`; grant only `service_role`.

### RLS and grants

- Enable and force RLS on every new tenant table.
- Revoke all direct privileges from `anon` and `authenticated` initially.
- The webhook uses the server-only service-role adapter and every query/function still carries explicit trusted organization/account filters.
- Employee visibility into channel metadata is deferred unless an existing dashboard requirement needs the canonical messages. Tokens, raw webhook material, and provider operational errors are never exposed to customers or normal employee DTOs.
- Add organization-immutability triggers and metadata length/size checks consistent with Phase 1 hardening.

## Tenant resolution

Tenant resolution follows this order:

1. Verify the Meta POST signature over the exact raw request bytes.
2. Parse the webhook and read `metadata.phone_number_id` from the signed envelope.
3. Resolve one active `whatsapp_accounts.phone_number_id` row.
4. Take `organization_id` only from that row.
5. Verify any WABA/display-number metadata only as consistency signals; never accept organization ID, slug, phone-number ID, or account ID from message text or model arguments.
6. Pass a trusted channel context to shared services. Unknown/inactive destinations are acknowledged without processing and logged with a sanitized code to avoid retry storms and tenant enumeration.

The Meta App ID and app secret are application-level webhook-authentication configuration; the phone-number mapping is the tenant boundary.

## Webhook endpoint

Implement both methods at `app/api/webhooks/whatsapp/route.ts`.

### GET verification

- Validate `hub.mode`, `hub.verify_token`, and `hub.challenge` as bounded strings.
- Require `hub.mode=subscribe` and compare the supplied verify token to `META_WHATSAPP_VERIFY_TOKEN` with a timing-safe comparison.
- Return the plain challenge with HTTP 200 only on a match.
- Return a plain, sanitized 403 on mismatch and 400 for malformed input.
- Never log either token.

### POST delivery

- Read the body once as raw bytes/text before JSON parsing.
- Require `X-Hub-Signature-256` in the `sha256=<hex>` form.
- Compute HMAC-SHA256 over the exact raw body using `META_APP_SECRET`; compare equal-length buffers with `timingSafeEqual`.
- Reject missing/malformed/invalid signatures before parsing or database access.
- Apply a strict maximum request size, JSON depth/array bounds through schemas, and accepted `object='whatsapp_business_account'` check.
- Parse only the fields needed from `entry[].changes[].value`: phone-number metadata, contacts, `messages[]`, and `statuses[]`. Reject or safely ignore unexpected shapes; never execute embedded instructions.
- Return a fast 200 after durable ingestion/claim scheduling. Do not make Meta wait on OpenAI or outbound delivery if the hosting runtime supports an approved durable worker. If Phase 5b remains synchronous, store first, cap processing time below the route/runtime limit, return 200 for stored work, and leave retryable state for an explicit recovery runner.
- A malformed or unauthenticated request receives 400/401/403; a valid duplicate receives 200 without another model call or outbound message.

## Receiving and processing inbound messages

For each supported text message:

1. Derive a new internal trace ID; never trust a trace ID from Meta.
2. Resolve the trusted account/tenant.
3. Validate provider message ID, sender `wa_id`, timestamp, and text length.
4. Call the transactional ingestion function. A uniqueness conflict is a duplicate success, not an exception.
5. Commit the inbound `messages` row and delivery state before any OpenAI call.
6. Claim the delivery lease.
7. Load channel-authorized agent context by trusted `(organization_id, conversation_id)`, without a browser token.
8. Invoke the same `AgentOrchestrator` and tool executor used by web chat. Reuse the same structured draft and deterministic next-stage logic.
9. Persist one assistant message and one outbound intent transactionally.
10. Send the persisted assistant content through the Meta client.
11. Record returned `wamid`, status, usage-safe metadata, and errors. Never replace the canonical message merely because delivery fails.

Unsupported inbound types are deduplicated and recorded with `unsupported`; respond once with a short text explaining that the test integration currently supports text, if allowed. Status-only webhook events never enter the agent.

## Shared conversation and request behavior

- Extract a channel-neutral conversation authorization/context contract from the current opaque-token repository path. Web continues to prove access with its token; WhatsApp proves ingress with Meta signature plus trusted account/identity mapping.
- Both adapters call the same draft update methods, deterministic workflow functions, `AgentOrchestrator`, `ToolExecutor`, and confirmation service.
- Do not call repositories directly from the model or Meta adapter.
- WhatsApp explicit confirmation is recognized as an inbound customer event only when the authoritative stored stage is `review` and the customer reply unambiguously confirms the immediately preceding persisted summary. The application service issues/holds confirmation material server-side and calls the existing confirmation RPC with a server-derived idempotency key based on the inbound provider message/turn. It never accepts request fields, tenant IDs, or reference numbers from the model/message.
- A duplicate confirmation webhook returns the existing request/reference and can replay the existing assistant response; it cannot create another request.
- If safe channel-neutral confirmation cannot reuse the existing nonce/RPC without changing its guarantees, implementation must stop and update this plan before introducing a new transaction. It must not create a WhatsApp-only request insert.

## Mapping customers and conversations

- Normalize Meta sender IDs to E.164-compatible digits before matching, but retain the signed provider `wa_id` as the unique channel identity.
- Scope every lookup by the trusted organization/account.
- Prefer an existing `whatsapp_identities` record.
- When no identity exists, reuse a customer only if exactly one same-tenant normalized phone matches; otherwise create a minimal customer with phone and no assumed name/consent.
- Store the optional Meta profile name only as untrusted display data. Do not silently overwrite a customer-confirmed name.
- Reuse one active mapped conversation. Create a new one only when no active mapping exists or a documented closed-conversation restart rule applies.
- Never merge identities across tenants, phone-number IDs, or based on customer-supplied organization text.

## Sending outbound messages

Create a server-only `MetaWhatsAppClient` integration that:

- Uses `POST https://graph.facebook.com/{reviewed-version}/{phone-number-id}/messages`.
- Sends `messaging_product: "whatsapp"`, `recipient_type: "individual"`, the trusted mapped recipient, and a bounded `type: "text"` body.
- Loads `META_WHATSAPP_ACCESS_TOKEN` only from server environment; never accepts it through function arguments originating outside configuration.
- Uses an abort timeout, sanitized error mapping, and a stable idempotent outbound delivery row.
- Validates Meta's response and records the returned `wamid` without exposing it to the model/browser.
- Does not auto-retry an ambiguous request that may have been accepted unless the outbound intent/provider response makes replay safe. Recovery checks the durable outbox state first.
- Does not send proactive free-form messages outside the active test conversation window and does not add templates in this phase.

## Environment variables

Add blank, documented server-only entries to `.env.example` and validation to the server schema:

```text
META_WHATSAPP_ENABLED=false
META_GRAPH_API_VERSION=
META_APP_ID=
META_APP_SECRET=
META_WHATSAPP_VERIFY_TOKEN=
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_BUSINESS_ACCOUNT_ID=
META_WHATSAPP_TEST_RECIPIENT=
META_WHATSAPP_REQUEST_TIMEOUT_MS=10000
META_WHATSAPP_MAX_WEBHOOK_BYTES=262144
```

`META_WHATSAPP_TEST_RECIPIENT` is a development allowlist guard and must be absent/handled differently before any production design. The database account mapping must match the configured phone-number/WABA IDs. When `META_WHATSAPP_ENABLED=true`, all required fields must validate at server startup/build; disabled mode must leave web chat and deterministic flow operational. No Meta variable uses `NEXT_PUBLIC_`.

Generate `META_WHATSAPP_VERIFY_TOKEN` locally with at least 32 random bytes (for example `openssl rand -hex 32`). It is a shared verification value chosen by this application, not the Meta access token or app secret.

## Webhook security

- HTTPS only outside local tests.
- GET verify-token comparison and POST HMAC signature verification are separate controls; the verify token does not validate POST deliveries.
- Signature validation uses the raw request body and the Meta App Secret with constant-time comparison.
- Validate sizes before parsing and bound every string/array.
- Treat sender IDs, names, text, timestamps, provider IDs, status errors, and all nested payload values as untrusted.
- Never log request headers, raw payloads, tokens, full phone numbers, full messages, profile names, or signatures.
- Resolve organization from signed destination configuration, then preserve explicit organization filters through service-role queries.
- Deduplicate before model spend and before any state mutation.
- Reject SSRF: Graph API base URL/version and path format are server-owned; webhook content cannot supply an outbound URL.
- Apply both account/sender message rate limits and a separate expensive-agent limit. A blocked AI call still leaves the stored message and deterministic fallback/recovery state.
- Verify client/server bundle output and source scans contain no Meta or OpenAI secret.
- Rotate a leaked temporary access token immediately in Meta and update secret storage; never paste it into issues, logs, tests, or chat.

## Deduplication, retry, and recovery

- The authoritative inbound idempotency key is `(whatsapp_account_id, provider_message_id)`.
- Database uniqueness, not an in-memory cache, decides duplicates under concurrency.
- Webhook batch retries may repeat messages and statuses in different groupings; process each item independently.
- Claim processing with a lease/status transition so only one worker invokes OpenAI. Expired leases are recoverable with a bounded attempt count.
- Once an assistant message/outbound intent exists for an inbound delivery, retries reuse it and never invoke the model or mutation tools again.
- State-changing agent tools retain their existing idempotency. WhatsApp confirmation derives its request idempotency from trusted persisted turn data.
- Provider 429/5xx/timeouts map to retryable outbound state with capped exponential backoff and jitter; authentication, permission, invalid-recipient, and schema errors are terminal until configuration is corrected.
- Do not blindly retry after an ambiguous outbound timeout. Record `delivery_unknown`/retry-review semantics or query/reconcile when Meta provides a safe mechanism.
- Delivery-status webhooks update `sent -> delivered -> read`; `failed` records sanitized codes. Out-of-order callbacks cannot downgrade a later state.
- Always return 200 to valid already-stored duplicates. Persistent internal ingestion failure should return 5xx so Meta can retry, without leaking the reason.

## Rate limiting

- Preserve the existing public message/AI limits but key WhatsApp limits by HMAC-digested `(account, wa_id)` rather than raw phone.
- Add bounds for webhook requests per source/account, supported messages per sender/window, OpenAI turns per sender/window, and outbound attempts per delivery.
- Do not rely on source IP as Meta's sole identity. Signature verification and provider-ID deduplication remain mandatory.
- Rate-limit only after authenticating the webhook sufficiently to avoid allowing unauthenticated traffic to consume tenant quotas.
- A rate-limited authentic message is stored with a recoverable/customer-safe state; it is not silently lost or allowed to bypass confirmation.

## Error handling

- Normalize errors to `invalid_signature`, `invalid_payload`, `unknown_destination`, `duplicate`, `rate_limited`, `database_unavailable`, `agent_fallback`, `meta_timeout`, `meta_rate_limited`, `meta_authentication`, `meta_rejected`, and `internal_error`.
- Webhook HTTP responses contain no stack, SQL, secret, tenant/customer existence detail, Meta response body, or OpenAI details.
- Preserve inbound content and authoritative draft when OpenAI fails; persist/send the same deterministic fallback used by web where possible.
- Preserve the assistant message and outbox intent when Meta send fails so a retry does not regenerate different prose or repeat tools.
- Invalid/unsupported inbound content cannot change draft/request state.
- A configuration failure disables WhatsApp processing loudly in server diagnostics without breaking web chat.

## Logging and trace IDs

Create one internal trace ID per webhook request and a child/turn identifier per message. Record structured, redacted events with:

- trace ID, organization/account IDs, pseudonymous identity/conversation/delivery IDs
- endpoint/event kind, provider message ID digest or internal delivery ID
- signature outcome, deduplication outcome, processing state, duration, attempt count
- agent instruction version/model/outcome/fallback reason and token counts already allowed by Phase 5
- outbound status and sanitized provider error category

Do not log raw body, message text, full phone/profile name, App Secret, verify/access token, signature, OpenAI key, prompt, tool arguments containing PII, or Meta error payload by default. Logging failure must not lose or duplicate a message.

## Meta Developer Portal manual setup

Portal wording can move. During implementation, use the current app dashboard at [Meta for Developers](https://developers.facebook.com/apps/) and the WhatsApp product's **API Setup**/**Configuration** pages. Stop if the portal requests a production business phone number; that is outside Phase 5b.

### Manual action 1: register for Meta for Developers

1. **Where to go:** `https://developers.facebook.com/`, signed into the Meta account that will own the test app.
2. **What to click:** **Get Started** (or **My Apps** if already registered), then complete developer registration and any account verification prompts.
3. **What to enter:** Meta-requested account/contact verification details; do not enter project secrets.
4. **What to copy back:** Nothing.
5. **Environment variable:** None.
6. **Verify:** **My Apps** opens and offers **Create App**.

### Manual action 2: create the Meta app

1. **Where to go:** Meta for Developers -> **My Apps**.
2. **What to click:** **Create App**. Choose the business/WhatsApp-capable use case shown by the current portal (often **Other** followed by **Business**, or a direct WhatsApp use case). Do not switch the app to Live mode.
3. **What to enter:** App name such as `SmartDesk AI BuildPro Test`, a monitored contact email, and the appropriate test Business Portfolio if Meta requires one.
4. **What to copy back:** From **App settings -> Basic**, copy the non-secret **App ID** into `META_APP_ID`. Treat the **App Secret** as a secret and place it directly in local/deployment secret storage as `META_APP_SECRET`; do not send it in chat or commit it.
5. **Environment variable:** `META_APP_ID`, `META_APP_SECRET`.
6. **Verify:** The app dashboard opens in Development mode and **App settings -> Basic** shows the same App ID.

### Manual action 3: add WhatsApp and obtain the test assets

1. **Where to go:** The app dashboard -> **Add products to your app**.
2. **What to click:** Find **WhatsApp**, click **Set up**, then open **WhatsApp -> API Setup**.
3. **What to enter:** Select or create the test Business Portfolio only if prompted. Do not add a real business phone number.
4. **What to copy back:** Copy the **Phone number ID** to `META_WHATSAPP_PHONE_NUMBER_ID`, the **WhatsApp Business Account ID** to `META_WHATSAPP_BUSINESS_ACCOUNT_ID`, and note the Meta-provided test number for manual messaging. Copy the Graph API version from Meta's generated request example to `META_GRAPH_API_VERSION` after confirming it is supported.
5. **Environment variable:** `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_GRAPH_API_VERSION`. The display test number is not a secret and may be documented locally without becoming tenant authority.
6. **Verify:** API Setup displays Meta's test **From** number, its phone-number ID, and a sample send-message panel.

### Manual action 4: authorize the test recipient

1. **Where to go:** App dashboard -> **WhatsApp -> API Setup**, in the **To**/**Recipient phone number** section.
2. **What to click:** **Manage phone number list** or **Add phone number**.
3. **What to enter:** Your test handset number in international format (country code plus number, no local leading zero where inappropriate). Complete the verification code delivered to that handset.
4. **What to copy back:** Put the normalized E.164 recipient number into the local-only `META_WHATSAPP_TEST_RECIPIENT`. Do not commit a personal number to `.env.example`, seeds, fixtures, screenshots, or logs.
5. **Environment variable:** `META_WHATSAPP_TEST_RECIPIENT`.
6. **Verify:** The number appears as verified/selectable in the **To** dropdown, and Meta's built-in **Send message** test delivers the sample/template message to the handset.

### Manual action 5: configure the temporary access token

1. **Where to go:** App dashboard -> **WhatsApp -> API Setup**.
2. **What to click:** Use the displayed **Temporary access token**/**Generate access token** control and authorize the requested test permissions.
3. **What to enter:** Only Meta's authorization prompts; do not paste the token into source files.
4. **What to copy back:** Copy the temporary token directly into untracked `.env.local` or the deployment preview's encrypted secret store as `META_WHATSAPP_ACCESS_TOKEN`. Do not provide the token to Codex/chat.
5. **Environment variable:** `META_WHATSAPP_ACCESS_TOKEN`.
6. **Verify:** Use Meta's built-in send test first. During implementation, run the project's opt-in Meta smoke command and confirm a successful response containing a `wamid`. Temporary tokens expire; expiry must surface as `meta_authentication`, not silently fail.

### Manual action 6: create the webhook verify token and public URL

1. **Where to go:** Locally in the project/deployment settings and in the app dashboard -> **WhatsApp -> Configuration**.
2. **What to click:** In Meta, under **Webhook**, click **Edit**/**Configure a webhook**.
3. **What to enter:** Set **Callback URL** to `https://<public-test-host>/api/webhooks/whatsapp`. Generate a random local value (at least 32 bytes) and enter the identical value as Meta's **Verify token**.
4. **What to copy back:** Store that generated value in server secret storage as `META_WHATSAPP_VERIFY_TOKEN`. Store the public host as `APP_BASE_URL` if not already configured. Do not paste the verify token into chat.
5. **Environment variable:** `META_WHATSAPP_VERIFY_TOKEN`; `APP_BASE_URL` for the HTTPS application origin.
6. **Verify:** Meta accepts/saves the callback. The route logs only a successful verification trace (not the token), and a manual GET with a wrong token returns 403.

### Manual action 7: subscribe to message webhooks

1. **Where to go:** App dashboard -> **WhatsApp -> Configuration** -> **Webhook fields**.
2. **What to click:** Locate `messages` and click **Subscribe**. If Meta exposes WABA app subscription separately, ensure this app is subscribed to the test WABA through the portal's provided control.
3. **What to enter:** No customer or tenant identifiers.
4. **What to copy back:** Nothing additional; confirm that the phone-number ID/WABA ID still match project configuration.
5. **Environment variable:** Existing `META_WHATSAPP_PHONE_NUMBER_ID` and `META_WHATSAPP_BUSINESS_ACCOUNT_ID` are used for the consistency check.
6. **Verify:** Send a text from the authorized handset to the Meta test number. Meta's webhook activity should show delivery, the application should store one inbound SmartDesk message, and a duplicate fixture/retry should not create another.

### Manual action 8: seed trusted test account mapping

1. **Where to go:** The project terminal after the Phase 5b migration is applied; do not use an undocumented Supabase dashboard edit.
2. **What to click:** Nothing in Meta. Run the documented development-only setup command/migration-safe script.
3. **What to enter:** BuildPro's known organization slug plus the non-secret test phone-number ID and WABA ID read from server environment. The script must refuse production and require `is_test=true`.
4. **What to copy back:** Nothing; secrets remain outside the database. Record only the non-secret mapping IDs in the development database.
5. **Environment variable:** `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_BUSINESS_ACCOUNT_ID`.
6. **Verify:** A read-only query/test shows exactly one active test account mapped to BuildPro, and an unknown phone-number ID resolves to no tenant.

### Manual action 9: end-to-end test

1. **Where to go:** WhatsApp on the authorized handset and the SmartDesk employee dashboard.
2. **What to click:** Open the Meta-provided test number chat and send `I want a quotation for house renovation.` Continue one answer at a time.
3. **What to enter:** Synthetic test-only name, confirmed handset number, service, description, and location; no real sensitive customer data. Review and explicitly confirm the summary.
4. **What to copy back:** Copy no secrets. Record only sanitized trace IDs/reference outcome in test notes.
5. **Environment variable:** No new variable.
6. **Verify:** Each inbound/outbound text appears once in the same SmartDesk conversation; no request exists before confirmation; confirmation creates exactly one dashboard request with a backend-generated reference; retrying the confirmation webhook returns the same request; web chat remains functional.

## Test strategy

### Unit tests

- Environment disabled/enabled matrix, Graph API version/ID/token/recipient validation, and absence from public environment.
- GET verification query schema and timing-safe token comparison.
- Raw-body signature parser: valid, wrong secret, wrong length, malformed hex, missing header, mutated body.
- Strict webhook envelope schemas, limits, batch flattening, text/status extraction, unsupported types, and extra/unexpected data handling.
- Phone/`wa_id` normalization without logging raw values.
- Meta client request path/body, timeout, response schema, redacted error normalization, and fixed base URL.
- Delivery-status monotonic transition rules and retry classification.
- Channel-neutral confirmation: only review-stage explicit confirmation, server-held data, stable idempotency, no browser/model fields/reference.
- Redaction and trace-ID generation.

### Database and RLS tests

- Every new row requires `organization_id`; composite foreign keys reject cross-tenant account/identity/customer/conversation/message links.
- `phone_number_id` and provider message ID uniqueness hold under concurrent inserts.
- The same `wa_id` can exist for different tenant accounts without crossing identities.
- Anonymous/authenticated roles cannot read/write WhatsApp tables or execute ingestion functions.
- Organization ID and provider identity are immutable.
- Concurrent duplicate inbound delivery creates one canonical customer message, one processing claim, one assistant reply, and one outbound intent.
- Customer matching reuses only unambiguous same-tenant records.
- Development test-account/sample-recipient data is absent from production-safe seed and cannot be applied when production safeguards are active.
- Status callbacks cannot regress `read` to `sent` or mutate another account's delivery.

### Mock webhook/integration tests

- GET challenge succeeds with matching token and fails safely otherwise.
- Signed inbound BuildPro text returns 200, stores before the mocked agent is invoked, uses trusted BuildPro organization, persists reply, and calls the mocked Meta endpoint once.
- Invalid signature causes no database/provider/agent activity.
- Unknown destination, forged organization text, foreign account, malformed payload, oversized input, and unsupported media cannot reach OpenAI or cross tenant scope.
- Duplicate sequential and concurrent deliveries do not call OpenAI/tools/send twice.
- Multi-entry/multi-message webhook batches are independently deduplicated.
- OpenAI timeout preserves inbound text and sends/stores deterministic fallback once.
- Meta timeout/error preserves reply/outbox; retry uses persisted reply and does not rerun the agent.
- Temporary-token expiry returns a sanitized configuration/auth outcome.
- Delivery status events update the correct outbound row and do not enter the agent.
- Explicit confirmation creates no request early, rejects missing fields, creates exactly one after confirmation, and returns only the backend reference.
- Existing web conversation route, Phase 4 E2E, and Phase 5 AI evaluations remain green.

### Manual Meta tests

- Meta built-in template/sample send reaches the authorized handset.
- Webhook verification saves successfully.
- Inbound plain text reaches the route and receives one response.
- Duplicate signed fixture replay does not duplicate rows or sends.
- Complete synthetic quotation journey and confirm exactly once.
- Disable OpenAI and repeat one turn; the deterministic response still arrives.
- Temporarily use an invalid Meta token in a non-production environment; the stored outbox records a sanitized failure and succeeds after restoring a valid token/recovery.
- Confirm no unauthorized handset can be selected as a test recipient through this phase's Meta setup.

## Migration and rollback safety

- Use one additive, version-controlled migration. Never edit the seven existing migrations.
- Before applying remotely, run local reset, pgTAP, schema lint, generated-type check, and inspect the SQL diff.
- Changing the channel check must preserve all existing `web` rows. Use a validated replacement constraint and test both allowed values and rejection of arbitrary values.
- Create tables/functions/grants/RLS before enabling the feature flag or configuring the webhook.
- Seed only the non-secret BuildPro test account mapping through an explicit development-only command guarded against production. Do not put a personal recipient or temporary token in migrations/seeds.
- Rollback operationally by setting `META_WHATSAPP_ENABLED=false` and unsubscribing the webhook first. Retain message/delivery data for recovery/audit.
- Do not drop tables or stored messages in an automatic rollback. Any destructive removal requires a later reviewed migration and retention decision.
- Temporary-token rotation changes secret storage only; it must not rewrite database history.

## Expected files to create or modify

Likely new files:

```text
app/api/webhooks/whatsapp/route.ts
lib/meta/whatsapp-client.ts
lib/meta/whatsapp-signature.ts
lib/meta/whatsapp-types.ts
lib/schemas/whatsapp-webhook.ts
lib/repositories/whatsapp-repository.ts
lib/repositories/supabase-whatsapp-repository.ts
lib/services/whatsapp-channel-service.ts
lib/services/whatsapp-runtime.ts
supabase/migrations/<timestamp>_phase_5b_whatsapp_test_channel.sql
supabase/tests/009_whatsapp_channel.sql
scripts/test-whatsapp-webhook.mjs
scripts/configure-whatsapp-test-account.mjs
tests/unit/meta/whatsapp-signature.test.ts
tests/unit/meta/whatsapp-client.test.ts
tests/unit/schemas/whatsapp-webhook.test.ts
tests/unit/services/whatsapp-channel-service.test.ts
```

Likely modified files:

```text
.env.example
package.json
lib/config/env-schema.ts
lib/config/env-server.ts
lib/supabase/database.types.ts
lib/services/public-conversation-service.ts
lib/repositories/public-conversation-repository.ts
lib/repositories/supabase-public-conversation-repository.ts
lib/agent/types.ts
lib/services/public-conversation-runtime.ts
docs/04_ARCHITECTURE.md
docs/07_API_CONTRACTS.md
docs/08_SECURITY_AND_PRIVACY.md
docs/11_DECISIONS.md
PROJECT_TREE.txt
docs/plans/phase-5b-meta-whatsapp-test-integration.md
```

Prefer Node's built-in `crypto` and `fetch`; do not add a Meta SDK or other production dependency unless implementation proves a specific need and records the decision.

## Commands to run during implementation

Confirm the scripts still exist before execution. Expected local sequence:

```bash
npm ci
npm run db:reset
npm run db:types
npm run db:types:check
npm run db:lint
npm run db:test
npm run test:ai
npm test
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run build
git diff --check
```

Expected Phase 5b-specific commands after scripts are added:

```bash
npm run db:seed:whatsapp:test
npm run test:whatsapp
```

The Meta live smoke test must be a separate opt-in command, require `META_WHATSAPP_ENABLED=true`, refuse non-test account configuration, use only the authorized test recipient, and never run in normal CI. A public HTTPS deployment/tunnel is required for Meta's callback; do not hard-code or commit its URL.

## Milestones

1. **Foundation and migration:** add validated server configuration, tenant/account/identity/conversation/delivery schema, RLS, functions, generated types, and pgTAP tests.
2. **Secure transport adapter:** add GET verification, raw-body signature verification, strict webhook parsing, server-only Meta sender, trusted tenant resolution, and mocked transport tests.
3. **Shared conversation integration:** introduce the smallest channel-neutral service boundary, persist/claim inbound turns, reuse the existing agent/deterministic draft services, persist outbox, and reuse the existing confirmation transaction.
4. **Recovery and validation:** add concurrency/deduplication, retry/status handling, rate limits, redacted tracing, route integration tests, manual test script/instructions, documentation, and all repository quality gates.

Each milestone must leave web chat, deterministic fallback, and Phase 5 evaluations working. Do not configure Meta until the secure endpoint and database tests pass.

## Acceptance criteria

- [x] Meta's app remains in Development mode and uses its test number plus an authorized test recipient only.
- [ ] All required portal actions and secrets are documented; secrets are placed directly in secret storage and absent from Git/chat/client bundles.
- [ ] GET webhook verification returns the challenge only for a matching server verify token.
- [ ] POST webhook processing requires a valid raw-body `X-Hub-Signature-256` HMAC before parsing or database access.
- [ ] The signed destination phone-number ID resolves exactly one active tenant account; customer/model content cannot select organization scope.
- [ ] Every new tenant-owned table includes enforced `organization_id`, composite foreign keys, forced RLS, restricted grants, and cross-tenant negative tests.
- [ ] Supported inbound text is durably stored in canonical `messages` before OpenAI/agent execution.
- [ ] Provider message IDs are deduplicated transactionally under sequential and concurrent retries.
- [ ] A WhatsApp identity maps to one same-tenant customer and active SmartDesk conversation without unsafe cross-tenant/ambiguous merging.
- [ ] WhatsApp calls the existing Phase 5 orchestrator, tool executor, deterministic workflow, and application services; no second agent or duplicated business logic exists.
- [ ] Conversation context uses bounded canonical public history and the authoritative structured draft.
- [ ] Agent/provider failure preserves the inbound message and yields the existing deterministic fallback/recoverable state.
- [ ] One persisted assistant reply creates one durable outbound intent and at most one normal Meta send attempt; retries never regenerate prose or repeat tools.
- [ ] Meta delivery IDs/statuses are validated, minimally stored, and updated without state regression.
- [ ] A request cannot be created before explicit summary confirmation, with missing required fields, for another tenant, more than once, or with a model/WhatsApp-generated reference.
- [ ] The existing `confirm_public_request` transaction remains the request creator and returns the same backend reference on retry.
- [ ] Unsupported message types and invalid webhook fields cannot reach OpenAI or mutate drafts.
- [ ] Account/sender/AI rate limits and bounded retry leases prevent abuse and retry storms without losing authentic messages.
- [ ] Errors and logs are sanitized and carry internal trace IDs without message bodies, full phone numbers, payloads, secrets, prompts, or credentials.
- [ ] Unit, mocked webhook, database/RLS, concurrency, cross-tenant, Phase 4 E2E, Phase 5 AI evaluation, lint, strict typecheck, formatting, build, and secret scans pass.
- [ ] Meta callback verification and the signed dashboard test pass; a tenant-matched signed synthetic inbound was persisted and produced a real deterministic-fallback reply to the authorized handset. Meta's unpublished-app restriction prevented a real handset inbound webhook, and a complete confirmed quotation remains deferred until a stable published test deployment is approved.
- [ ] No production number, production token workflow, marketing/template system, separate agent, Phase 6 attachment behavior, or other later-phase feature is implemented.

## Security review checklist

- Confirm raw bytes are preserved exactly for signature verification.
- Confirm App Secret, verify token, access token, service-role key, and OpenAI key are server-only and redacted.
- Confirm the Graph API base URL/version/path cannot be supplied by webhook/model content.
- Confirm unknown phone-number IDs do not fall back to BuildPro or another default tenant.
- Confirm every repository query has organization/account scope even under service-role access.
- Confirm provider IDs have database uniqueness and duplicate processing has a durable claim.
- Confirm customers cannot be merged across tenants or by profile name.
- Confirm inbound persistence commits before OpenAI.
- Confirm confirmation uses stored draft/server material and existing idempotent request transaction.
- Confirm status/handoff/attachment capabilities remain unavailable where their secure services do not exist.
- Confirm logs, error responses, fixtures, `.env.example`, source maps, and browser chunks contain no tokens, raw phone/message data, or signatures.
- Confirm development sample recipient/account configuration cannot be applied to production.

## Progress log

- [x] Read `AGENTS.md`, `.agent/PLANS.md`, and all documents requested for Phase 5b planning.
- [x] Read `docs/00_INDEX.md` because repository instructions require it.
- [x] Inspect package scripts/dependencies, environment validation, Phase 4 schema, RLS/migrations, public routes, repositories/services, Phase 5 agent/runtime, and existing tests.
- [x] Verify that no WhatsApp route, Meta integration, provider identity mapping, or provider-message deduplication table currently exists.
- [x] Reconcile the test integration with the explicit production-WhatsApp non-goal.
- [x] Review current Meta setup concepts for the test number, authorized recipient, verification challenge, POST signature, and messages endpoint; reverify exact portal labels/API version during implementation.
- [x] Create the Phase 5b execution plan only.
- [x] User reviewed and approved this plan through the Phase 5b implementation request.
- [x] Milestone 1: configuration, additive migration, RLS, functions, and database tests.
- [x] Milestone 2: secure webhook and Meta transport adapter.
- [x] Milestone 3: shared conversation/agent/confirmation integration.
- [x] Milestone 4: recovery, rate limits, observability, tests, docs, and manual Meta instructions.
- [x] Run all locally available acceptance commands and record exact results; live Meta Portal/handset checks remain manual.

## Decision log

- 2026-08-10: Phase 5b is a Meta developer-test integration only. Production phone onboarding, App Review, permanent production credentials, templates, and business verification remain out of scope.
- 2026-08-10: WhatsApp is a transport adapter around the existing SmartDesk conversation and Phase 5 agent, not a new agent or business workflow.
- 2026-08-10: Trusted tenant scope comes from the signature-verified destination `phone_number_id` mapped in `whatsapp_accounts`, never from sender content or a default tenant.
- 2026-08-10: Provider-ID uniqueness and processing leases live in PostgreSQL because webhook retries and server concurrency cannot be controlled safely with process memory.
- 2026-08-10: Inbound canonical content is committed before OpenAI. Assistant prose is persisted before Meta sending so recovery never repeats tools or changes a reply.
- 2026-08-10: Channel identity has its own tenant-scoped table. Customer phone matching is only a cautious same-tenant bootstrap and never replaces provider identity.
- 2026-08-10: Meta secrets remain environment-managed; the database stores only non-secret account identifiers and operational delivery metadata.
- 2026-08-10: Start with text messages and customer-initiated replies in Meta's test environment. Media and production template messaging require separate review.
- 2026-08-10: Reuse the existing confirmation RPC and backend reference allocator. Any necessary channel-neutral adapter must preserve server-stored draft, explicit confirmation, and idempotency rather than add direct request inserts.
- 2026-08-10: Use Node's built-in `crypto` and `fetch` initially; no Meta SDK dependency is justified for this narrow surface.
- 2026-08-11: Meta's current dashboard signs `messages` samples with synthetic WABA ID `"0"`. The envelope validator accepts that signed test identifier, while trusted tenant resolution still ignores it because it cannot match a configured account.
- 2026-08-11: The portal fixed the webhook field subscription at v26.0 while the temporary outbound Graph API token used v25.0. Both paths passed independently; inbound schema compatibility is not coupled to the outbound endpoint version.

## Known risks and limitations

- Meta Portal labels, onboarding choices, Graph API versions, temporary-token lifetimes, and test-recipient limits can change. Implementation must re-check the current portal and generated example; this plan intentionally does not freeze an unverified API version.
- A temporary token expires and is unsuitable for unattended or production operation. Manual rotation is expected in this phase.
- A public HTTPS webhook URL is required. A local tunnel is ephemeral and must not be treated as a stable deployment.
- Serverless request lifetimes are a poor durable job queue. If synchronous post-ingestion processing proves unreliable, implementation must introduce a reviewed durable worker/queue design rather than claiming webhook delivery alone guarantees agent completion.
- Meta may redeliver, batch, or reorder messages and status callbacks. Database idempotency and monotonic state updates are required but do not eliminate all ambiguous outbound timeout cases.
- Phone numbers can be reassigned and profile names are untrusted. The channel identity mapping reduces accidental merges but a production identity lifecycle/retention policy remains undecided.
- Customer-service messaging windows and template rules limit outbound replies. This test phase supports replies to customer-initiated messages only.
- Full media/attachment support, audited human handoff, and verified status lookup remain unavailable until their dedicated phases.
- The existing Phase 5 implementation has no general durable background job framework. Phase 5b must make recovery explicit and must not acknowledge successful processing merely because ingestion succeeded.
- Production conversation, delivery metadata, phone identity, and log retention periods remain undefined and must be decided before real-customer deployment.

## Completion notes

Implemented locally on 2026-08-10 without beginning Phase 7. The implementation
adds a version-controlled developer-test channel migration, raw-body webhook
authentication, strict envelope parsing, trusted destination-to-tenant mapping,
durable provider deduplication and processing claims, customer/conversation
mapping, the server-only Meta sender, and mocked plus database security tests.

WhatsApp calls the existing `PublicConversationService`, Phase 5 orchestrator,
stored draft, deterministic fallback, and Phase 4 confirmation transaction. The
first confirmation at review issues and displays a server-built structured
summary; a subsequent explicit confirmation reuses the stored nonce digest and
stable server-derived idempotency key. No Meta secret, recipient, account ID, or
hosted configuration was guessed or committed.

Manual Meta Portal setup, temporary secret configuration, hosted migrations, and
the trusted BuildPro account mapping were completed on 2026-08-11. A temporary
HTTPS tunnel passed callback verification and Meta's signed v26.0 dashboard
test. Because Meta explicitly suppresses real data while this app is
unpublished, a tenant-matched signed synthetic inbound exercised persistence,
the deterministic fallback, Meta outbound delivery, and receipt on the
authorized handset. The temporary subscription was then removed, the tunnel
was stopped, and the verify token was rotated. A stable public deployment and
published-app review remain required before real handset inbound messages can
be validated. Production WhatsApp, media, templates, and automatic retries
after ambiguous outbound timeouts remain out of scope.

Local verification results:

- `npm run db:reset` applied all ten migrations and the production-safe seed.
- The repository-pinned `supabase test db` passed 160 assertions across 11 files.
- `npm run db:lint` reported no schema errors.
- `npm run test:whatsapp` passed 20 tests across five files after adding the signed Meta dashboard-test compatibility regression.
- `npm test` passed 110 tests across 26 files.
- `npm run test:ai` passed 28 tests across five files.
- `npm run lint`, `npm run typecheck`, and `npm run format:check` passed.
- `npm run build` passed and emitted the dynamic WhatsApp webhook route.
- The complete `npm run db:test` integration command passed the database,
  reference concurrency, employee Auth, protected route, request, public
  conversation, and private Storage checks.

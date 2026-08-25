# Architecture

## Architecture style

Use a modular monolith for the MVP.

This keeps deployment and development simple while preserving boundaries that can later become separate services if scale demands it.

## High-level components

```text
Browser
  |
  | HTTPS
  v
Next.js application
  ├── Public chat UI
  ├── Request status UI
  ├── Employee dashboard
  └── Server routes/actions
          |
          ├── Application services
          ├── Authorization and validation
          ├── Agent orchestration
          ├── OpenAI Responses API
          └── Supabase
                ├── PostgreSQL
                ├── Auth
                └── Private Storage
```

## Trust boundaries

### Browser

Untrusted.

The browser may hold:

- Supabase anon key
- User session token
- Public organization identifier
- Display data allowed by policy

The browser must never receive:

- OpenAI API key
- Supabase service-role key
- Internal system prompts
- Unfiltered internal notes
- Cross-tenant data

### Next.js server

Trusted application boundary.

Responsibilities:

- Validate input
- Authenticate employees
- Resolve organization
- Authorize actions
- Call OpenAI
- Execute agent tools
- Use privileged database operations only when necessary
- Generate signed file URLs
- Apply rate limits and idempotency
- Return sanitized errors

### OpenAI model

Reasoning component, not an authority.

The model may:

- Classify intent
- Extract structured candidate fields
- Decide the next conversational question
- Request approved tools
- Draft grounded answers

The model may not:

- Bypass authorization
- Directly access arbitrary database data
- Invent references
- Approve financial or technical decisions
- Be trusted to validate its own tool arguments

### Supabase

System of record for:

- Organizations and memberships
- Customers and requests
- Conversations and messages
- Assignments and statuses
- Audit events
- Attachment metadata
- Knowledge metadata

## Application layers

### UI layer

Directories:

```text
app/
components/
```

Responsibilities:

- Render pages
- Manage local interaction state
- Call typed server endpoints
- Show loading, error, empty, and success states
- Avoid business rules

### API or server action layer

Directory:

```text
app/api/
```

Responsibilities:

- Parse request
- Validate schema
- Authenticate
- Resolve tenant
- Call application service
- Map domain result to HTTP response

### Application service layer

Directory:

```text
lib/services/
```

Example services:

- `conversation-service`
- `request-service`
- `assignment-service`
- `status-service`
- `handoff-service`
- `attachment-service`
- `knowledge-service`

Responsibilities:

- Coordinate repositories and integrations
- Enforce workflow rules
- Create audit events
- Return typed results

### Repository layer

Directory:

```text
lib/repositories/
```

Responsibilities:

- Encapsulate database queries
- Require organization scope
- Avoid UI concerns
- Return domain-oriented data

### Agent layer

Directory:

```text
lib/agent/
```

Suggested modules:

```text
lib/agent/
├── instructions.ts
├── orchestrator.ts
├── tool-definitions.ts
├── tool-executor.ts
├── conversation-context.ts
├── response-parser.ts
└── safety.ts
```

Responsibilities:

- Build model input
- Provide approved tools
- Validate tool calls
- Execute tools through application services
- Continue the response loop
- Persist messages and tool events
- Enforce escalation and grounding rules

Implemented Phase 5 uses a server-only Responses API adapter, versioned instructions, bounded customer-safe context, six allowlisted tool schemas, a validating service dispatcher, a maximum tool loop, and deterministic fallback. Structured conversation drafts and the Phase 4 confirmation transaction remain authoritative; provider state is never the business system of record.

Implemented Phase 6 keeps attachment metadata and Storage access behind an
attachment service/repository boundary. Browsers receive only one-object signed
upload tokens and, after a new authorization check, 60-second signed downloads.
The `private-attachments` bucket is private; paths contain trusted tenant and
target identifiers plus a random UUID, never an original filename. Stored bytes
are type/size validated before activation and are not placed in agent context.

Phase 5b adds a test-only WhatsApp transport adapter. Meta webhook signatures
are verified over raw bytes before a trusted destination phone-number mapping
selects the tenant. Durable provider delivery rows deduplicate and claim each
turn, while the existing `PublicConversationService`, Phase 5 orchestrator,
stored draft, and confirmation transaction remain the only conversation and
request workflow. Processing leases keep provider retries active until failed
work can be reclaimed. Outbound replies are claimed before sending; explicit
Meta rate limits retry the persisted reply, while ambiguous timeouts and server
errors enter a non-retriable review state to prevent duplicate customer sends.

### Integration layer

Directories:

```text
lib/openai/
lib/meta/
lib/supabase/
```

Responsibilities:

- Configure SDK clients
- Hide vendor-specific details
- Normalize errors
- Prevent client-side secret exposure

## Request flow: customer chat

1. Browser posts a customer message with conversation ID.
2. Server validates input and public tenant context.
3. Message is saved.
4. Server loads a bounded conversation context and active organization configuration.
5. Agent orchestration calls the Responses API.
6. The model returns text or a tool request.
7. Tool arguments are schema-validated.
8. Tool executor calls an application service.
9. Service authorizes, validates, writes data, and audits.
10. Tool result is returned to the model.
11. Final customer-safe response is saved and returned.
12. UI renders the response.

## Request flow: employee status change

1. Employee submits a status change.
2. Server validates session.
3. Server resolves membership and organization.
4. Status service checks role and allowed transition.
5. Database transaction updates request and creates history.
6. A notification event is created when appropriate.
7. UI receives updated request.

## Conversation context strategy

Do not send unlimited conversation history.

Send:

- Current organization identity and approved instructions
- Active request summary, if authorized
- Recent relevant messages
- Confirmed collected fields
- Current conversational state
- Relevant knowledge results
- Tool definitions

Store a rolling summary when conversations become long. Never rely only on a model-generated summary for critical values; retain structured confirmed fields.

## Knowledge strategy

MVP preference:

- Store organization knowledge documents and approved FAQ entries.
- Retrieve only active tenant-scoped content.
- Include citations or source identifiers internally.
- The assistant must decline or escalate when evidence is missing.

Do not mix knowledge across tenants.

## Error strategy

Use typed error categories:

- `validation_error`
- `unauthenticated`
- `forbidden`
- `not_found`
- `conflict`
- `rate_limited`
- `external_service_error`
- `internal_error`

Customer-facing errors must be clear but must not expose stack traces, SQL, secrets, prompts, or internal identifiers.

## Observability

Record:

- Request ID or trace ID
- Organization ID
- Endpoint
- Duration
- Model name
- Tool name
- Tool outcome
- Error category
- Token or usage information where available

Do not log full sensitive conversation content by default.

## Phase 7 human ownership boundary

Web and Meta test messages use the shared conversation service. A database
handoff row is the authority for ownership: `queued` and `assigned` do not mean
an employee is present; only an explicit `assigned -> active` transaction does.
While active, customer messages are persisted and audited without invoking the
model or deterministic draft workflow. Assignment, joining, employee replies,
resolution, and optional automation resume are transaction-safe database
operations behind tenant-scoped application services.

## Deployment principle

Begin with one web application and one Supabase project. Separate development, staging, and production environments before real customer data is used.

## Phase 8 status-verification boundary

Public status lookup uses a server-only challenge service and provider
abstraction. References never authorize reads. OTPs and short-lived status
tokens are stored only as HMAC digests, attempts are transactionally bounded,
and tokens bind to one tenant and request. Public responses use a six-field
allowlist that excludes notes, priorities, history reasons, and employee data.

## Phase 10 SaaS and production WhatsApp boundary

Self-service owners create an `onboarding` organization and first admin
membership transactionally. Public customer channels require an active tenant
lifecycle and eligible provider-independent subscription.

One Meta app and signed webhook serve multiple companies. Destination
phone-number ID plus WABA ID resolves exactly one tenant account. Developer-test
accounts additionally require a stored recipient allowlist. Production
credentials are encrypted with AES-256-GCM using tenant/account authenticated
data and a versioned server key. The browser receives only public Meta IDs and
an expiring one-use signup state.

WhatsApp remains a transport, not a separate agent. It calls the same
conversation service, agent orchestration, handoff ownership, and confirmed
idempotent request transaction as web chat.

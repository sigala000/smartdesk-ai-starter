# Plan: Phase 7 Human Handoff and Follow-up

## Goal

Deliver a tenant-isolated human handoff and customer follow-up workflow for the
existing web chat, employee dashboard, and Meta developer-test transport. A
customer can explicitly request an employee, deterministic safety/escalation
rules can create a handoff automatically, authorized employees can see and own
the queue, and an employee can join, reply, resolve, and deliberately return a
conversation to the automated assistant.

The backend handoff record is authoritative. The virtual assistant may say that
a handoff was requested or queued only after the application service returns
that persisted state. It must never claim that a human has joined, is assigned,
or is actively handling the conversation until the corresponding backend state
exists.

## User value

- Customers can reach a real BuildPro employee without losing conversation or
  request context.
- Safety concerns, complaints, payment/legal disputes, serious anger, and
  unsupported uncertainty become visible employee work rather than unsupported
  assistant promises.
- Employees have one queue for triage, assignment, ownership, replies, and
  resolution.
- Request-more-information becomes a complete two-way workflow instead of only
  recording an employee question.
- Managers receive an auditable account of who requested, assigned, joined,
  replied, resolved, cancelled, or resumed automation.

## Current repository state

### Working foundations

- Phase 0 through Phase 6 and the Phase 5B Meta developer-test adapter exist.
- The working tree currently contains reviewed but uncommitted Phase 5B
  hardening changes. Phase 7 implementation must preserve those changes and
  establish a reviewed baseline before editing overlapping conversation,
  agent, migration, or documentation files.
- Supabase Auth resolves one active membership and role on the server.
- Employee request services already use explicit permissions, tenant-scoped
  repositories, typed results, bounded schemas, and authenticated RPCs.
- `human_handoffs` already contains tenant, conversation, optional request,
  status, priority, reason, assignee, requested/resolved timestamps, and
  tenant-consistent foreign keys.
- Its allowed statuses already match the domain contract: `requested`,
  `queued`, `assigned`, `active`, `resolved`, and `cancelled`.
- `conversations` already has `state` and `assigned_member_id`; the
  `human_handoff` state is allowed.
- `messages` supports customer, assistant, and employee messages and requires
  an employee sender to have a same-tenant member ID.
- The public conversation view already exposes only customer-safe customer,
  assistant, and employee messages. It excludes system/tool metadata and
  internal notes.
- The employee request detail already shows the linked customer conversation,
  including employee messages.
- `request_more_information(...)` currently inserts an employee question,
  changes an eligible request to `awaiting_customer_information`, and audits
  the action.
- The existing notification table and RLS support employee recipients and
  read-only content with recipient-controlled `read_at`.
- The agent has a strict `request_human_support` schema, output-claim checking,
  and escalation language, but the tool is intentionally not executable and
  its executor currently returns `capability_unavailable`.
- Deterministic safety handling currently offers human contact without creating
  a backend handoff.
- Web and WhatsApp messages already converge on
  `PublicConversationService`; Phase 7 must extend that shared boundary rather
  than introduce channel-specific handoff business logic.

### Gaps and documentation/repository differences

1. Handoff creation, transitions, assignment, joining, employee reply, and
   resolution have no application service, repository, API, or dashboard UI.
2. Handoff RLS currently permits manager writes and conversation-authorized
   reads, but it does not express the Phase 7 role/assignee transition rules.
   Direct table writes must be replaced by narrowly granted RPCs.
3. There is no partial uniqueness constraint preventing multiple open handoffs
   for the same conversation.
4. The handoff row lacks separate queued, assigned, activated, cancelled, and
   automation-resumed timestamps and structured resolution provenance.
5. `request_more_information(...)` rejects conversations in `resolved` state,
   while Phase 4 request confirmation deliberately sets the conversation to
   `resolved`. Confirmed requests therefore need a safe transactional reopen to
   `awaiting_customer`.
6. The request-information transaction creates no customer notification
   record. The current `notifications.recipient_member_id` is mandatory, so
   the table cannot represent the customer notifications described by the
   product and API documents.
7. Customer replies do not currently close the follow-up loop, restore the
   request from `awaiting_customer_information`, notify the requesting/assigned
   employee, or audit receipt.
8. Public message processing does not pause OpenAI or deterministic assistant
   replies while an employee owns an active handoff.
9. The public chat has no queue/assigned/active status presentation or refresh
   strategy for employee messages.
10. The request detail UI says delivery is not part of Phase 3 and has no
    handoff state or employee reply controls.
11. The safety example in `docs/06_AGENT_BEHAVIOR.md` says "I will transfer"
    without demonstrating a successful backend result. Phase 7 documentation
    must make this claim conditional on the returned handoff state.

These gaps materially shape the implementation but do not block this plan.

## Scope

- Explicit customer handoff from the web-chat action and natural language.
- Explicit handoff from the existing Meta developer-test WhatsApp path through
  the same application service.
- Deterministic automatic escalation classification and priority selection.
- Executable `request_human_support` agent tool backed by the handoff service.
- Idempotent creation and one non-terminal handoff per conversation.
- Handoff status transitions, priorities, ownership, and timestamps.
- Tenant-scoped employee queue with filtering and cursor pagination.
- Authorized assignment to an active same-tenant employee.
- Explicit employee join that changes backend state to `active`.
- Employee replies in the customer-visible conversation.
- Agent pause while a handoff is active.
- Employee resolution or cancellation and an explicit resume-automation choice.
- Complete request-more-information delivery, customer response, request status
  restoration, employee notification, and audit behavior.
- Employee and customer notification records; actual web delivery uses the
  canonical conversation, while external SMS/email delivery remains deferred.
- Web customer and employee dashboard loading, empty, success, conflict, and
  error states.
- Safe behavior for the existing WhatsApp test transport without expanding it
  into production WhatsApp.
- Unit, database, RLS, API integration, cross-tenant, AI evaluation, and browser
  journey tests.

## Out of scope

- Phase 8 request-status verification.
- Production WhatsApp onboarding, templates, business-number messaging, or
  permanent Meta credentials.
- SMS, email, push, or voice notification providers.
- Service-level response-time promises or automated staffing schedules.
- Emergency-service dispatch or claims that emergency services were contacted.
- Multi-agent orchestration or a separate employee/WhatsApp agent.
- Automatic quotation, pricing, payment, legal, engineering, or scheduling
  decisions.
- General-purpose ticketing, workforce management, live typing indicators, or
  real-time presence infrastructure.
- Realtime subscriptions if bounded polling/refetch provides a reliable MVP.
- Sending attachment contents to OpenAI.

## Dependencies and assumptions

- The Phase 5B hardening working tree is reviewed and committed or otherwise
  preserved before Phase 7 implementation begins.
- The existing opaque conversation token remains the public authorization
  boundary for web customers.
- The signature-verified WhatsApp destination mapping remains the trusted
  tenant boundary for Meta test messages.
- Employee authorization continues to come from the server-resolved active
  membership, never from submitted organization/member IDs.
- BuildPro's active `Customer Support` department is the deterministic default
  queue destination. Missing support configuration produces a persisted failed
  handoff result and honest fallback; it must not silently route to another
  tenant or arbitrary department.
- `admin`, `manager`, and `support_officer` can triage the general handoff queue.
  A member explicitly assigned to a handoff can view, join, reply, and resolve
  it even if their role is another operational non-viewer role and they already
  have authorization to the linked request/conversation. `viewer` cannot act.
- Managers/admins may assign any active, non-viewer same-tenant member.
  Support officers may self-claim or assign an active support-department member;
  broader delegation fails closed.
- Employee notification records are in-app records only during Phase 7.
- Customer notification records represent delivery intent and canonical web
  conversation availability. They must not claim external delivery when no
  provider ran.
- A request-information customer reply returns
  `awaiting_customer_information -> new`, matching the documented status graph.
  If the request has moved elsewhere concurrently, the reply is retained and
  audited but the status transition uses an explicit conflict-safe rule rather
  than overwriting the newer status.
- One active employee owns a conversation at a time. Multiple employees may
  view according to authorization, but only the active handoff assignee or a
  manager override may send as the current owner.

## Domain design

### Handoff statuses and transitions

Allowed transitions are a closed server-owned graph:

```text
requested -> queued
requested -> cancelled
queued -> assigned
queued -> cancelled
assigned -> assigned       (audited reassignment)
assigned -> active         (employee explicitly joins)
assigned -> cancelled
active -> resolved
active -> cancelled        (manager/admin exceptional path with reason)
resolved -> queued         (new handoff record preferred; no ordinary reopen)
```

Normal repeat escalation after `resolved` or `cancelled` creates a new handoff.
It does not mutate historical terminal records. There is at most one handoff in
`requested`, `queued`, `assigned`, or `active` for a conversation.

`requested` records validated intent. Deterministic routing immediately moves a
successfully created handoff to `queued` in the same transaction and audits both
events. Customer-facing success normally returns `queued`. This preserves the
domain status while avoiding invisible work stuck at `requested`.

### Priority

- `normal`: explicit human request or unresolved/unsupported company question.
- `high`: serious complaint, sustained anger after failed assistance, payment
  dispute, legal/contract question, or suspected fraud without immediate danger.
- `urgent`: immediate safety risk, threat, injury, fire, collapse, severe
  incident, or danger to people/property.

The backend may elevate a model-proposed priority based on deterministic rules;
it may never downgrade a detected safety priority. Customer text is stored but
not copied wholesale into audit metadata or logs. The handoff reason is bounded
and minimized.

### Conversation ownership and automation state

- `queued`: conversation state is `human_handoff`; no employee owner is claimed.
- `assigned`: `conversations.assigned_member_id` is set, but the customer sees
  only that the request is assigned/awaiting an employee—not that the employee
  has joined.
- `active`: the assigned member has explicitly joined; the active handoff and
  conversation owner agree, and automated assistant generation is paused.
- `resolved` with resume enabled: ownership is cleared, the conversation moves
  to `open` or `resolved` according to request/follow-up state, and automation
  may answer subsequent customer messages.
- `resolved` without resume: the handoff ends but conversation automation stays
  paused/closed according to an explicit backend state; no implied AI restart.

Do not infer employee presence from assignment, page visibility, notification
delivery, or an assistant-generated sentence.

### Automatic escalation triggers

Create a pure domain classifier that returns either no escalation or:

```ts
type EscalationDecision = {
  reasonCode: EscalationReasonCode;
  priority: "normal" | "high" | "urgent";
  customerSafetyMessage?: string;
};
```

It covers explicit human requests, immediate safety, serious damage/injury,
threat/fraud, payment/legal disputes, serious complaints, repeated assistance
failure, anger, highly sensitive unnecessary data, and unsupported uncertainty
after one useful clarification. Tests must avoid broad matches such as treating
"human resources" or quoted safety text as an automatic active handoff.

Run deterministic escalation before OpenAI. Persist the customer message first,
then call the handoff service. The model may also request the strictly validated
tool, but it never supplies tenant scope, conversation scope, or authoritative
request ownership.

### Agent pause

The shared conversation application service must query authoritative handoff
and ownership state before invoking either OpenAI or deterministic workflow
automation. While a handoff is `active`:

1. Persist and deduplicate the customer message.
2. Do not invoke OpenAI, execute agent tools, advance draft fields, or create an
   assistant message.
3. Create/update an in-app notification for the assigned employee.
4. Return a customer-safe conversation view whose status says the message was
   delivered to the active employee.

During `queued` or `assigned`, use a documented policy: customer messages remain
stored and notify the queue/assignee, while the assistant provides at most one
server-authored acknowledgement and does not claim a human is active. Avoid
generating repeated acknowledgements for duplicate messages.

The WhatsApp test adapter must accept a successful no-assistant-reply outcome
while automation is paused instead of treating absence of an assistant message
as a processing failure. Employee-originated outbound WhatsApp test delivery
may reuse the existing persisted outbox/sender only for the configured test
recipient; production messaging remains out of scope.

## Handoff application services

Create a focused `HandoffService` with typed results and a repository interface.
Suggested operations:

- `requestFromCustomer(context, input)`
- `requestFromAgent(trustedAgentContext, input, customerMessageId)`
- `listQueue(employeeAccess, query)`
- `detail(employeeAccess, handoffId)`
- `assign(employeeAccess, handoffId, input)`
- `join(employeeAccess, handoffId, expectedUpdatedAt)`
- `sendEmployeeMessage(employeeAccess, handoffId, input)`
- `resolve(employeeAccess, handoffId, input)`
- `cancel(employeeAccess, handoffId, input)`
- `recordCustomerFollowUp(context, clientMessageId, message)`

All expected business failures return discriminated results such as
`forbidden`, `not_found`, `conflict`, `validation_error`, `rate_limited`, and
`internal_error`. Routes map them to sanitized HTTP responses.

State-changing operations use transaction-safe database functions so handoff,
conversation ownership, messages, request state, notifications, and audit rows
cannot partially diverge.

## Request-more-information workflow

Replace or harden the existing RPC transaction rather than adding a second
implementation.

### Employee action

1. Validate authenticated permission and current request access.
2. Lock the request and linked conversation.
3. Validate optimistic concurrency and allowed request transition.
4. Allow a confirmed conversation currently marked `resolved` to reopen as
   `awaiting_customer`; reject closed/cancelled ownership conflicts.
5. Insert one employee message with actor provenance and an idempotency key.
6. Move the request to `awaiting_customer_information` when appropriate.
7. Create a customer notification record with delivery status `available` for
   web, and a provider-specific queued intent only when an implemented channel
   adapter can actually deliver it.
8. Audit the question and any request/conversation transition.
9. Return the actual persisted result; never claim delivery beyond that result.

### Customer response

1. Authorize the conversation through its normal channel boundary.
2. Persist and deduplicate the customer message before any model call.
3. Detect an outstanding information request from server state, not model text.
4. Link the response to the employee question using `reply_to_message_id` and/or
   a dedicated follow-up record.
5. Mark the customer notification/respond-needed item satisfied.
6. If the request is still `awaiting_customer_information`, transition it to
   `new` and record status history/audit provenance `customer_follow_up`.
7. Notify the assigned/requesting employee or appropriate support queue.
8. If a human handoff is active, keep automation paused. Otherwise allow the
   shared assistant to acknowledge or continue only after the transaction.

Multiple responses are preserved, but only the first valid response completes
one outstanding follow-up. Duplicate client message IDs do not create another
status transition or notification.

## Notification strategy

Extend the current notification model additively rather than creating an
unrelated second table unless migration analysis shows that preserving current
RLS is safer with a dedicated `customer_notifications` table.

Preferred shape:

- Make `recipient_member_id` nullable.
- Add nullable same-tenant `recipient_customer_id` and `conversation_id`.
- Require exactly one recipient type.
- Add `channel` (`in_app`, `web`, `whatsapp_test`) and delivery status
  (`pending`, `available`, `sent`, `failed`, `read`, `responded`).
- Add bounded `deduplication_key`, `sent_at`, `failed_at`, and sanitized
  `failure_code` as needed.
- Preserve immutable notification content; only controlled functions update
  status/read fields.
- Add partial indexes for employee unread items, customer pending items, and
  request/conversation lookup.

Employee queue notifications target active eligible same-tenant members.
Customer notification content is customer-safe and never includes internal
notes, employee private data, prompts, raw tool arguments, or secrets.

## API contracts

All request bodies use strict bounded schemas and existing trace/error helpers.

### Customer

- `POST /api/conversations/{conversationId}/handoffs`
  - Opaque conversation authorization.
  - Body: `clientRequestId`, bounded reason, optional customer-selected reason
    code; priority is server-derived or validated/elevated.
  - Idempotently returns `{handoff: {id,status,priority,requestedAt}}`.
- Existing message endpoint recognizes active ownership/follow-up state and
  returns the updated customer-safe conversation plus a handoff summary.
- Existing conversation GET returns customer-safe handoff status and employee
  messages, but no assignee identity beyond an approved generic display label.

### Employee

- `GET /api/dashboard/handoffs`
  - Filters: status, priority, assigned-to-me, request reference/search, cursor,
    and bounded limit.
- `GET /api/dashboard/handoffs/{handoffId}`
  - Returns authorized customer-safe transcript, request link/summary, handoff
    state, timestamps, and allowed actions.
- `PATCH /api/dashboard/handoffs/{handoffId}/assignment`
  - Body: same-tenant active `memberId`, reason, `expectedUpdatedAt`.
- `POST /api/dashboard/handoffs/{handoffId}/join`
  - Body: `expectedUpdatedAt`; atomically establishes active ownership.
- `POST /api/dashboard/handoffs/{handoffId}/messages`
  - Body: `clientMessageId`, bounded customer-visible message.
- `POST /api/dashboard/handoffs/{handoffId}/resolve`
  - Body: bounded resolution note, `resumeAutomation`, `expectedUpdatedAt`.
- `POST /api/dashboard/handoffs/{handoffId}/cancel`
  - Restricted exceptional action with mandatory reason.
- Retain `POST /api/dashboard/requests/{requestId}/request-information`, but
  extend its response with actual message/notification state and add an
  employee-generated idempotency key.

No endpoint accepts `organization_id`, actor member ID, conversation owner, or
tenant routing from its request body.

## Employee handoff queue and UI

- Add a role-aware `Handoffs` navigation item only for roles with queue access.
- Add `/dashboard/handoffs` with priority/status filters, cursor pagination,
  empty state, loading state, sanitized error state, and overdue-neutral wording
  that makes no SLA promise.
- Order queue work by urgent, high, normal and then oldest requested timestamp;
  implement with an indexed deterministic priority rank plus ID tie-breaker.
- Add `/dashboard/handoffs/[handoffId]` with transcript, linked request, reason,
  priority, status timeline/audit summary, assignee, and allowed controls.
- Assignment does not display "joined". Only a successful join response changes
  the UI and customer-visible state to active.
- Employee reply forms preserve text on failure, prevent duplicate clicks with a
  stable client message UUID, and refresh from backend state after success.
- Resolution explicitly asks whether automation should resume and displays the
  resulting backend state.
- Integrate handoff/follow-up state into request detail without duplicating the
  handoff service or repository.

## Customer UI

- Make "Speak with an employee" call the explicit handoff endpoint and display
  only the returned backend state.
- Display distinct truthful states:
  - requested/queued: "Your request for human support is in the queue."
  - assigned: "Your conversation has been assigned. An employee has not joined
    yet."
  - active: "A BuildPro employee has joined this conversation."
  - resolved/resumed: "The employee conversation has ended. The virtual
    assistant is available again."
- While active, keep the message composer enabled for customer-to-employee
  messages but hide/disable automated draft actions that would advance the
  assistant workflow.
- Refresh via bounded polling after a handoff is queued/assigned/active so web
  customers can receive employee messages without requiring realtime in this
  phase. Stop polling on unmount/terminal state and avoid overlapping requests.
- Preserve drafts and messages on failed operations and offer a safe retry.
- Safety copy advises avoiding danger and contacting appropriate local emergency
  services when relevant; it never says BuildPro or emergency services are
  already responding.

## Role and authorization strategy

Add explicit permissions rather than depending on navigation visibility:

- `handoffs:list`
- `handoffs:view`
- `handoffs:assign`
- `handoffs:join`
- `handoffs:message`
- `handoffs:resolve`
- `handoffs:cancel`
- `notifications:view`

Suggested policy:

- `admin`, `manager`: all handoff actions.
- `support_officer`: queue/list/view, self-claim or support-department
  assignment, join, message, resolve.
- Other operational roles: view/join/message/resolve only when explicitly
  assigned and already authorized for the linked conversation/request.
- `viewer`: no handoff or notification access.

Every service checks permission and record scope. Every state-changing RPC
repeats the critical active membership, tenant, assignee, and status checks
inside the transaction. A hidden control is never an authorization mechanism.

## Database changes

Create one additive Phase 7 migration after the current Phase 5B hardening
migration. It should:

1. Add missing handoff lifecycle timestamps and bounded resolution/cancellation
   fields.
2. Add a partial unique index for one non-terminal handoff per conversation.
3. Add indexes for deterministic queue pagination and assignee work.
4. Add an idempotency key scoped to organization/conversation for customer/tool
   handoff creation.
5. Add notification customer/conversation/channel/status fields and recipient
   constraints, or document why a dedicated tenant-owned customer notification
   table is safer.
6. Add follow-up linkage/idempotency fields to messages or a dedicated
   `conversation_follow_ups` table if one question/response cannot be enforced
   cleanly with `reply_to_message_id` alone.
7. Add immutable tenant triggers to any new tenant-owned table/columns.
8. Replace broad handoff manager writes with read policies plus controlled
   functions. Revoke direct authenticated inserts/updates/deletes where
   application invariants require transactions.
9. Add security-definer functions with empty `search_path` for create/queue,
   assign, join, employee reply, resolve/cancel, request information, and
   customer follow-up receipt.
10. Revoke function execution from `public` and `anon`; grant only the narrow
    employee functions to `authenticated` and server adapter functions to
    `service_role`.
11. Ensure functions lock handoff/conversation/request rows consistently to
    prevent double joins, reassign-during-reply races, and lost status updates.
12. Write audit and notification rows in the same transaction as the state or
    message change.
13. Regenerate `lib/supabase/database.types.ts` from the migrated local schema.

Do not delete or rewrite existing handoff, notification, message, or audit data.
Use `NOT VALID` plus validation or safe defaults where an existing populated
column constraint must change.

## Row Level Security and tenant isolation

- Every new/changed tenant record carries `organization_id`.
- Composite foreign keys enforce same-tenant conversation, request, customer,
  member, message, handoff, and notification links.
- Public customers receive no direct table grants. Opaque-token server routes
  call narrowly scoped service-role functions.
- Service-role repositories include explicit organization and entity filters.
- Employee reads require active membership plus queue/assignment/request access.
- Assignment rejects foreign, inactive, viewer, or policy-ineligible members.
- Conversation ownership cannot be changed by general direct table update.
- Model arguments cannot supply tenant, owner, actor, authoritative request ID,
  current status, or active-state claims.
- Customer-safe DTOs exclude internal notes, audit metadata, employee contact
  details, model/tool metadata, and notification failure details.

## Audit trail

Append audit events for:

- `handoff.requested`
- `handoff.queued`
- `handoff.assigned`
- `handoff.reassigned`
- `handoff.activated`
- `handoff.employee_message_sent`
- `handoff.resolved`
- `handoff.cancelled`
- `conversation.automation_paused`
- `conversation.automation_resumed`
- `request.information_requested`
- `request.customer_information_received`
- Any resulting `request.status_changed`

Audit metadata contains fixed reason codes, previous/new states, and safe IDs;
it must not duplicate full customer/employee messages, phone numbers, secrets,
prompts, or internal notes. Public customers never receive raw audit rows.

## Failure and concurrency behavior

- Duplicate customer handoff requests return the existing open handoff and do
  not create new queue notifications.
- Two employees attempting to claim/join use row locks and optimistic timestamps;
  one succeeds and the other receives a typed conflict with current state.
- Assignment to a deactivated/foreign member fails without changing ownership.
- A failed handoff transaction does not pause automation or produce a queued
  success claim. The customer receives an honest, customer-safe fallback and
  alternative contact guidance from approved organization information.
- If employee message persistence succeeds but external WhatsApp test delivery
  fails, retain the canonical message and provider outbox status; do not claim
  delivery or regenerate different prose.
- If notification creation is part of a state-change invariant, fail the whole
  transaction. Optional secondary notifications may fail independently only
  when the primary handoff/message remains visible and the failure is audited.
- Resolving and receiving a customer message concurrently must lock in a fixed
  order. The resulting customer message is never lost; automation runs only if
  the committed state permits it.
- Deactivating an assigned member prevents new actions. A manager can reassign
  the stranded handoff; the agent does not silently resume.

## Agent integration

- Add `request_human_support` to `executableAgentTools` only after its service is
  implemented and tested.
- Extend `ToolServices` and `ToolExecutor` to call the handoff application
  service with trusted conversation/organization context.
- Keep the existing strict argument schema and validate every model call.
- Derive or elevate priority and request linkage on the server. A supplied
  request ID must be ignored or validated as the conversation's same-tenant
  linked request; it cannot select arbitrary customer data.
- Return explicit results containing `success`, `handoffId`, and actual status.
  Failure always includes `success:false`; output validation must never treat a
  missing success flag as action evidence.
- Update customer-safe output validation so:
  - queued claims require a successful `queued`/`assigned` result;
  - joined/active claims require an actual `active` result;
  - employee action/delivery claims require corresponding backend evidence.
- Automatic safety escalation must not depend on OpenAI availability.
- Once active ownership is detected, the orchestrator is not called at all.
- Update stable server instructions and agent behavior docs without exposing
  employee-only details or adding another agent.

## Test strategy

### Unit tests

- Closed handoff transition graph and terminal-state behavior.
- Priority derivation/elevation for explicit request, anger, complaint,
  payment/legal dispute, fraud, and urgent safety cases.
- False-positive escalation fixtures.
- Permission matrix for each role, assigned member, and manager override.
- Strict public/employee schemas, bounded reasons/messages, and idempotency IDs.
- Agent tool argument validation and unavailable/success/failure results.
- Output validator rejects "an employee joined" for queued/assigned/failed tool
  results and accepts it only for backend `active` evidence.
- Agent pause decision from authoritative handoff state.
- Customer-safe DTOs exclude internal and cross-tenant data.
- Queue cursor ordering by priority/requested timestamp/ID.

### Database and RLS tests

- Explicit and automatic creation returns one open handoff under sequential and
  concurrent duplicate calls.
- Same-tenant support routing and missing-support failure.
- Every allowed and forbidden status transition.
- Assignment/join rejects foreign, inactive, viewer, unauthorized, or stale
  members.
- Two simultaneous join attempts produce one active owner.
- Active handoff, conversation state, and assigned member cannot diverge.
- Resolve/cancel timestamps and ownership clearing/resume behavior.
- Employee reply and notification/audit rows are atomic.
- Public/anon roles cannot list or mutate handoffs, notifications, messages, or
  audit records.
- Organization A cannot read, assign, join, reply to, resolve, or receive
  notifications for organization B.
- Request-information reopens a confirmed `resolved` conversation safely.
- Customer response links to the outstanding question, transitions the request
  once, and notifies the correct same-tenant employee.
- Duplicate customer response does not repeat status/audit/notification changes.
- Notification recipient XOR, same-tenant foreign keys, immutable content, and
  permitted status/read updates.
- Migration applies from the current schema and the production-safe seed remains
  free of operational handoffs/notifications.

### API integration tests

- Unauthenticated employee queue/actions are rejected.
- Deactivated and viewer members are rejected.
- Queue filters/pagination and empty results.
- Cross-tenant IDs return not found/forbidden without existence leakage.
- Customer opaque-token handoff creation and invalid/expired token failures.
- Duplicate explicit handoff requests return the same handoff.
- Assign, join, employee reply, resolve, cancel, and stale-state conflicts.
- Request-more-information creates the employee message, customer notification,
  request status, and audit rows.
- Customer web response is visible to the employee and resumes the request
  correctly.
- While active, web and WhatsApp-test customer messages are stored without any
  OpenAI call or assistant response.
- Provider/notification failure preserves canonical messages and truthful state.
- Responses and logs contain no secrets, full phone numbers, internal notes,
  prompts, raw tool arguments, or SQL errors.

### AI evaluations

Add or extend fixtures for:

- Explicit human request.
- Unsupported service after one clarification.
- Angry customer and repeated failure.
- Payment dispute and legal/contract question.
- Immediate safety concern, injury, threat, fraud, and severe damage.
- Unnecessary highly sensitive data.
- Prompt injection asking to fabricate an active employee.
- Attempt to assign/access another tenant's employee or conversation.
- Handoff service failure.
- Provider outage with deterministic automatic escalation.
- Queued versus assigned versus active wording.

Every fixture declares expected priority, expected tool/service call, actual
backend state, forbidden active/joined claims, and required safety wording.

### End-to-end journeys

1. Web customer explicitly requests a human; one queued handoff appears in the
   employee queue.
2. Employee assignment is visible, but customer UI does not say joined.
3. Assigned employee joins; only then customer UI shows an active human.
4. Customer and employee exchange messages while OpenAI is not invoked.
5. Employee resolves and resumes automation; next customer turn may use the
   assistant again.
6. Employee requests information on a confirmed request; customer sees the
   question, replies, and the employee receives a notification.
7. Urgent safety language creates an urgent queue item and safe guidance without
   unsupported emergency-response claims.
8. Cross-tenant and deactivated-member journeys fail without data leakage.
9. Duplicate clicks/retries create one handoff, message, notification set, and
   audit transition.

## Security review

- Public routes authenticate only through existing opaque channel context.
- Employee routes resolve active membership server-side for every request.
- All external/model/UI input is schema validated and bounded.
- Database transactions repeat authorization and state checks.
- No public table access is broadened.
- No service-role or OpenAI/Meta secret reaches browser code.
- No model output determines tenant, ownership, member assignment, priority
  downgrade, or transition validity.
- The agent cannot claim joined/assigned/delivered states without backend
  evidence from the current operation.
- Internal notes and audit metadata remain employee-only and outside agent/public
  context.
- Rate-limit explicit handoff creation, customer messages, employee replies, and
  expensive automatic escalation/model operations using tenant-scoped subjects.
- Logs use trace IDs and safe reason/status codes, not message bodies or contact
  details.
- Cross-tenant negative tests cover every new function and endpoint.
- Urgent safety copy is conservative and never impersonates emergency services.

## Migration and rollback safety

- All database changes are version-controlled migrations; no dashboard-only
  schema/policy edits.
- Take additive steps first, backfill only deterministic values, validate new
  constraints after inspecting existing rows, then revoke unsafe writes.
- Do not drop handoff or notification records during rollback.
- Feature rollback disables new routes/navigation/tool execution and pauses new
  handoff creation while retaining queue and audit data for manual handling.
- If a migration fails, the transaction leaves the old Phase 6/5B behavior
  intact. Never partially enable the agent tool before schema/functions exist.
- Apply locally with reset/lint/tests, inspect the remote migration dry run, then
  deploy only after review. Run hosted post-deployment tenant/RLS smoke checks.
- Any reversal of conversation ownership must be an explicit forward migration,
  not destructive history rewriting.

## Expected files to create

Exact names may be adjusted to existing conventions during implementation, but
do not invent files that inspection shows unnecessary.

```text
app/api/conversations/[conversationId]/handoffs/route.ts
app/api/dashboard/handoffs/route.ts
app/api/dashboard/handoffs/[handoffId]/route.ts
app/api/dashboard/handoffs/[handoffId]/assignment/route.ts
app/api/dashboard/handoffs/[handoffId]/join/route.ts
app/api/dashboard/handoffs/[handoffId]/messages/route.ts
app/api/dashboard/handoffs/[handoffId]/resolve/route.ts
app/api/dashboard/handoffs/[handoffId]/cancel/route.ts
app/dashboard/handoffs/page.tsx
app/dashboard/handoffs/loading.tsx
app/dashboard/handoffs/error.tsx
app/dashboard/handoffs/[handoffId]/page.tsx
app/dashboard/handoffs/[handoffId]/loading.tsx
app/dashboard/handoffs/[handoffId]/error.tsx
components/handoffs/handoff-list.tsx
components/handoffs/handoff-detail.tsx
components/handoffs/handoff-actions.tsx
lib/domain/handoffs.ts
lib/dto/handoff-dto.ts
lib/schemas/handoff-api.ts
lib/repositories/handoff-repository.ts
lib/repositories/supabase-handoff-repository.ts
lib/services/handoff-service.ts
lib/services/handoff-runtime.ts
supabase/migrations/<timestamp>_phase_7_human_handoff_follow_up.sql
supabase/tests/012_human_handoff_follow_up.sql
tests/unit/handoffs/handoff-domain.test.ts
tests/unit/handoffs/handoff-schemas.test.ts
tests/unit/handoffs/handoff-service.test.ts
scripts/test-handoff-routes.mjs
```

## Expected files to modify

```text
app/api/conversations/[conversationId]/messages/route.ts
app/api/dashboard/requests/[requestId]/request-information/route.ts
components/chat/public-chat.tsx
components/dashboard/dashboard-navigation.tsx
components/requests/request-actions.tsx
components/requests/request-detail.tsx
lib/agent/instructions.ts
lib/agent/orchestrator.ts
lib/agent/safety.ts
lib/agent/tool-definitions.ts
lib/agent/tool-executor.ts
lib/agent/types.ts
lib/auth/permissions.ts
lib/domain/conversation-workflow.ts
lib/dto/public-conversation-dto.ts
lib/dto/request-dto.ts
lib/repositories/public-conversation-repository.ts
lib/repositories/request-repository.ts
lib/repositories/supabase-public-conversation-repository.ts
lib/repositories/supabase-request-repository.ts
lib/services/public-conversation-runtime.ts
lib/services/public-conversation-service.ts
lib/services/request-service.ts
lib/supabase/database.types.ts
supabase/tests/003_rls_tenant_isolation.sql
supabase/tests/006_request_management.sql
tests/evaluations/phase-5-agent-evaluations.test.ts
tests/fixtures/agent-evaluations/phase-5.json
tests/unit/agent/context-and-safety.test.ts
tests/unit/agent/orchestrator.test.ts
tests/unit/agent/tool-schemas.test.ts
tests/unit/auth/permissions.test.ts
tests/unit/conversations/conversation-workflow.test.ts
tests/unit/requests/request-service.test.ts
package.json
docs/03_DOMAIN_AND_WORKFLOWS.md
docs/04_ARCHITECTURE.md
docs/06_AGENT_BEHAVIOR.md
docs/07_API_CONTRACTS.md
docs/08_SECURITY_AND_PRIVACY.md
docs/09_TESTING_AND_ACCEPTANCE.md
docs/11_DECISIONS.md
```

Do not modify Phase 5B files merely to reformat them. Modify the WhatsApp
adapter only where shared pause/reply semantics require it.

## Commands to run during implementation

Inspect actual scripts before use; the current repository provides:

```bash
npm ci
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
npm run db:types:check
npm run lint
npm run typecheck
npm test
npm run test:ai
npm run test:whatsapp
npm run format:check
npm run build
git diff --check
git status --short
```

Add the Phase 7 route script to `npm run db:test` only after it is stable and
self-cleaning. Run the focused handoff tests during development, then the full
suite. Do not report a command passed unless it ran successfully.

## Milestones and implementation order

1. **Baseline and schema safety**
   - Preserve/commit the completed Phase 5B hardening baseline.
   - Inspect live local rows before tightening constraints.
   - Add lifecycle, idempotency, notification/follow-up, indexes, grants, RLS,
     functions, and database types.
   - Add pgTAP integrity, transition, concurrency, and cross-tenant tests.
2. **Application/domain services**
   - Add handoff domain rules, schemas, DTOs, repository, typed service, and
     runtime.
   - Complete request-information and customer-response transaction semantics.
   - Add permission and service tests.
3. **Customer and agent integration**
   - Add explicit public handoff endpoint/action.
   - Add deterministic automatic escalation and executable agent tool.
   - Enforce active-handoff agent pause in the shared conversation service.
   - Make web and WhatsApp test adapters honor the same state.
4. **Employee queue and ownership UI**
   - Add protected queue/detail routes and pages.
   - Add assignment, join, employee reply, resolve/cancel, loading, empty,
     conflict, and failed-operation states.
   - Integrate handoff/follow-up state into request detail.
5. **End-to-end hardening**
   - Add route integration and browser journeys, AI evaluations, secret/log
     checks, migration reset/lint/types, and all repository quality gates.
   - Update source-of-truth documentation and decisions with actual behavior.
   - Review remote migration dry run and deploy only after explicit implementation
     review.

## Acceptance criteria

- [ ] Explicit web and WhatsApp-test human requests create exactly one visible
      same-tenant queued handoff.
- [ ] Automatic escalation creates the correct normal/high/urgent handoff even
      when OpenAI is disabled or unavailable.
- [ ] A failed handoff never produces a queued, assigned, joined, active, or
      delivered success claim.
- [ ] The model cannot choose tenant, conversation owner, arbitrary request, or
      downgrade a server-detected priority.
- [ ] Queue/list/detail/action endpoints require active server-resolved employee
      authorization and pass cross-tenant negative tests.
- [ ] Assignment accepts only an authorized active same-tenant member and does
      not imply that the employee joined.
- [ ] Only a successful explicit join makes the handoff `active`, sets matching
      conversation ownership, and permits customer-facing "joined" wording.
- [ ] While active, customer messages are persisted and delivered to the human
      workflow without OpenAI, deterministic draft advancement, or assistant
      replies.
- [ ] Employee messages have actor provenance, are customer-visible, are
      idempotent, and survive provider/notification failures.
- [ ] Resolve/cancel and optional automation resume are transactional and
      audited; automation cannot resume from hidden UI state alone.
- [ ] Request-more-information works for a confirmed request, creates one
      employee question and customer notification, and moves the request to
      `awaiting_customer_information` when valid.
- [ ] A customer response is linked, preserved, audited, visible to the employee,
      notifies the correct recipient, and returns the request to `new` exactly
      once when appropriate.
- [ ] Customer/employee notification records enforce one same-tenant recipient,
      immutable content, truthful channel/status, and deny broad public access.
- [ ] Every handoff state/assignment/message/follow-up mutation creates the
      required append-only audit event without sensitive message content.
- [ ] Internal notes, employee private data, prompts, tools, and other-tenant
      records never enter customer or model context.
- [ ] Duplicate clicks, provider retries, concurrent claims, stale updates, and
      deactivated assignees fail safely.
- [ ] Web UI includes accessible loading, empty, error, conflict, queue,
      assigned, active, resolved, and failed-handoff states.
- [ ] No production WhatsApp, Phase 8 status verification, external notification
      provider, pricing, or other later-phase feature is introduced.
- [ ] Local migration reset/lint/types, database/RLS tests, route integration,
      unit tests, AI evaluations, WhatsApp regressions, lint, typecheck,
      formatting, build, diff review, and secret review pass.

## Progress checklist

- [x] Read `AGENTS.md`, `.agent/PLANS.md`, `docs/00_INDEX.md`, and every document
      requested for Phase 7 planning.
- [x] Read `docs/04_ARCHITECTURE.md`, `docs/05_DATABASE_SCHEMA.md`,
      `docs/10_IMPLEMENTATION_ROADMAP.md`, and `docs/11_DECISIONS.md` as required
      by the repository planning/backend reading map.
- [x] Inspect the current working tree, package scripts, routes, dashboard UI,
      Auth permissions, schema/migrations/RLS, handoff/notification tables,
      request-information transaction, public conversation service, agent tool
      registry/safety, WhatsApp adapter, generated types, and tests.
- [x] Identify current schema/document differences and record non-blocking
      assumptions.
- [x] Create this Phase 7 execution plan only.
- [x] Review and approve this plan.
- [x] Preserve the existing Phase 5B hardening changes while making Phase 7
      edits; no Phase 5B change was discarded.
- [x] Implement Milestone 1: additive migration, RLS/RPC boundaries, lifecycle
      constraints, indexes, follow-up transactions, generated types, pgTAP,
      and real concurrent creation test.
- [x] Implement Milestone 2: domain classifier, schemas, DTOs, repository,
      typed service, permissions, and protected runtime.
- [x] Implement Milestone 3: public handoff API/action, escalation, executable
      agent tool, active-handoff pause, follow-up response, and WhatsApp
      no-assistant completion path.
- [x] Implement Milestone 4: protected queue/detail pages and assignment, join,
      employee reply, resolve, explicit resume, loading, empty, and error UI.
- [x] Complete Milestone 5 verification and record exact final results below.

## Decision log

- 2026-08-11: Treat the handoff record and its status—not model text,
  notification state, assignment, or UI visibility—as the authority for human
  presence.
- 2026-08-11: Assignment and joining are separate transitions. Only `active`
  permits a customer-facing claim that an employee joined.
- 2026-08-11: Use one open handoff per conversation and return it idempotently;
  terminal handoffs remain immutable history and later escalation creates a new
  record.
- 2026-08-11: Detect urgent/mandatory escalations deterministically before the
  model so OpenAI availability cannot suppress safety or explicit-human routing.
- 2026-08-11: Pause automation in the shared conversation application service,
  ensuring web and WhatsApp test transports cannot diverge on ownership rules.
- 2026-08-11: Extend the existing request-information transaction rather than
  duplicate it. Confirmed `resolved` conversations may reopen only through the
  controlled follow-up transaction.
- 2026-08-11: Customer notification records describe truthful delivery intent or
  web availability; no external delivery is claimed without a provider result.
- 2026-08-11: Use bounded polling for the Phase 7 web MVP. Realtime presence is
  unnecessary for correctness and may be revisited after pilot evidence.
- 2026-08-11: Existing Phase 5B test WhatsApp remains a transport adapter around
  shared handoff/conversation services; it does not receive a separate agent or
  production messaging design.
- 2026-08-11: Post-implementation audit hardening makes escalation priority a
  server-derived value, returns server-owned handoff acknowledgements, and
  rejects model or browser attempts to assert that a human joined.
- 2026-08-11: All handoff and request-information mutations lock the
  conversation before subordinate handoff/request rows. Terminal idempotency
  keys replay their original result, and simultaneous acceptance permits
  exactly one owner and one activation audit event.
- 2026-08-11: Explicit automation resume derives the safe conversation state
  from the draft/request lifecycle and rejects cancelled or terminal work.

## Known risks and limitations

- Employee/customer notification retention and production delivery providers
  remain undecided; Phase 7 records in-app/web availability only.
- Bounded polling is not instant realtime and may delay visible join/reply state
  by the polling interval.
- The current notification table is employee-only. Implementation must choose
  the additive recipient extension or a dedicated customer notification table
  after inspecting migration safety; either choice must preserve tenant RLS and
  immutable content.
- Automatic anger/complaint classification can produce false positives. Keep
  mandatory deterministic patterns narrow, evaluate fixtures, and allow human
  triage without silently resuming automation.
- A deactivated owner can strand an active handoff until an authorized manager
  reassigns it. The queue must expose this condition without leaking identity.
- No external SLA or employee availability configuration exists, so customer
  copy cannot promise a response time.
- WhatsApp test outbound ambiguity remains governed by Phase 5B delivery states;
  Phase 7 must not blindly retry `delivery_unknown` messages.
- Production retention, backups, staging, and privacy policy remain Phase 9
  prerequisites before real customer operation.

## Completion notes

Implementation completed on 2026-08-11. The delivered behavior uses one
transaction-safe open handoff per conversation, separates assignment from
acceptance, pauses assistant generation for open human ownership, makes
employee replies customer-visible, resolves/resumes only through explicit
backend state, and links request-information questions and replies to the same
request. Database/RLS, unit, AI, WhatsApp, integration, formatting, lint,
typecheck, and production-build results are recorded after the final quality
gate run.

Post-audit final verification on 2026-08-11:

- `npm run db:reset`: passed; all migrations and production-safe seed applied.
- `npm run db:lint`: passed with no schema errors.
- `npm run db:test`: passed; 196 pgTAP assertions, 20 concurrent reference
  allocations, 12 concurrent handoff requests producing one handoff, exactly
  one winner under simultaneous acceptance, and all
  employee-auth, protected-route, request-route, public-conversation, and
  attachment integrations passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 135 tests in 28 files.
- `npm run test:ai`: passed, 29 tests in 5 files.
- `npm run test:whatsapp`: passed, 27 tests in 5 files.
- `npm run format:check`: passed.
- `npm run build`: passed with all Phase 7 API and dashboard routes compiled.
- `npm run db:types`: passed and regenerated the checked-in schema types.
  `db:types:check` cannot return zero before these intended generated changes
  are committed because the script compares the file to Git `HEAD`; the
  generated file itself is current with the final local schema.

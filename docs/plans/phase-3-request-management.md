# Plan: Phase 3 Request Management

## Goal

Deliver the authenticated employee request-management slice without AI or public customer chat. An authorized employee can list and search only the requests they may access, open a request-safe detail view, assign a department and eligible employee, apply supported status transitions, review append-only status history, add employee-only notes, and record a request for more information. All reads and writes are organization-scoped, role-authorized on the server, protected by Row Level Security (RLS), and expressed through typed business results.

Phase 3 is complete only when a development request can be processed through the supported employee workflow from the dashboard and direct API access cannot bypass tenant, department, assignment, role, or data-visibility rules.

## User value

BuildPro employees gain the first operational workflow after authentication: they can find a customer request, understand its current state, route it to the responsible team, record internal context, and advance it through valid steps without relying on an AI provider. Managers gain trustworthy assignment and status history, and customers' data remains isolated from other tenants and from customer-facing response shapes.

## Current state

The repository is at commit `c788b98` after completed Phase 2. Inspection confirmed:

- Next.js 16.3, React 19, strict TypeScript, Zod 4, Vitest, ESLint, Prettier, and npm lockfile-based installation are configured.
- Supabase local development, version-controlled migrations, generated database types, pgTAP, Auth/RLS integration runners, and GitHub Actions are present.
- Phase 2 provides cookie-aware Supabase browser/server clients, verified server-side user resolution, exactly-one-active-membership resolution, closed employee roles, permission helpers, protected dashboard routes, and role-aware navigation.
- `lib/core/result.ts` provides a generic `Result<T, E>` and `lib/core/errors.ts` provides the shared sanitized application error categories.
- There is no `app/api/`, `lib/repositories/`, or `lib/services/` directory yet. There are no request schemas, DTOs, repositories, services, API routes, list/detail pages, or request-management permissions.
- The Phase 1 schema already includes organizations, memberships, departments, services, customers, conversations, messages, requests, status history, assignments, attachments, internal notes, handoffs, notifications, feedback, counters, and audit events.
- Tenant relationships use composite `(organization_id, id)` foreign keys; tenant IDs and request identity fields are immutable.
- Request references are generated transaction-safely by the database and cannot be supplied or changed by callers.
- RLS is forced. Managers (`admin` and `manager`) can currently read/write requests broadly; operational roles can read a request only when personally assigned or in its department. Anonymous roles have no table access.
- The current application permission set covers only `dashboard:view` and `organization:view`.
- `supabase/seeds/development.sql` contains one guarded, local-only sample customer and request. It has no Auth employee, conversation, assignment history, status changes, or notes.
- Existing tests cover schema integrity, tenant isolation, database hardening, authentication, authorization, concurrent reference generation, and protected Phase 2 routes.

### Documentation and repository reconciliation

The source documents agree on tenant-scoped employee request list/detail, assignment, validated transitions, append-only history, and private notes. The following gaps are real but do not prevent a safe plan:

1. `assignments.member_id` is currently required and the table has no `department_id`, so it cannot represent department-only routing or a complete historical snapshot of the assignment API. Phase 3 needs a forward migration that adds `department_id`, permits a null member, and requires at least one assignment target.
2. `request_status_history` lacks the documented `changed_by_type` and `source` fields. Its trigger records the actor but cannot record the action's reason. Phase 3 needs a forward migration and a controlled transition function that supplies provenance atomically.
3. The Phase 3 roadmap includes audit history, while the requested plan emphasizes status history. Phase 3 will write audit events for request mutations and expose status/assignment history in request detail; a general audit-log UI is not required.
4. `POST /request-information` is specified in the API contract, but the roadmap schedules the customer follow-up workflow and notifications for Phase 7. Phase 3 will implement the authenticated employee-side action: store a customer-safe employee question on an existing request conversation, transition the request when appropriate, and audit it atomically. It will not claim delivery, create a fake customer notification, or accept a customer reply. A request without a linked conversation returns a typed conflict. Phase 4/7 will add the public delivery/reply path.
5. The documentation does not define a complete per-role transition matrix. This plan uses a conservative, explicit Phase 3 matrix described below. Unknown roles and unlisted actions default to denial. Any change to that matrix during implementation must be recorded in `docs/11_DECISIONS.md`.
6. Some canonical transitions require entities not yet implemented (site-visit schedule, approved quotation attachment, customer acceptance, client completion confirmation). The transition rule module will recognize the canonical graph but deny prerequisite-dependent transitions until the required evidence exists. It must never simulate that evidence.

No contradiction requires guessing about public chat, OpenAI, attachments, quotation upload, or customer notification delivery; those remain outside Phase 3.

## Scope

Phase 3 includes:

- Tenant-scoped request repository interfaces and Supabase implementations.
- Application services for list, detail, assignment, status transition, internal note, and request-more-information operations.
- Typed domain values, input schemas, DTOs, and discriminated business results.
- Authenticated employee JSON APIs under `/api/dashboard/requests`.
- Filters for status, department, assigned employee, and service.
- Bounded normalized search.
- Stable opaque cursor pagination.
- Responsive dashboard request list with loading, error, empty, filter, and pagination states.
- Protected request detail page with customer-safe request/conversation data and separately authorized employee-only data.
- Department assignment and same-tenant active employee assignment.
- Explicit status-transition rules and prerequisite checks.
- Append-only status and assignment history.
- Employee-only internal notes.
- Employee-side request-more-information recording for requests with a linked conversation.
- Server authorization and RLS hardening needed for operational roles.
- Development-only request fixtures sufficient for manual and automated Phase 3 verification.
- Unit, API/service integration, pgTAP/RLS, HTTP authorization, and cross-tenant negative tests.
- Documentation, generated database types, CI, and plan progress updates required by the implementation.

## Out of scope

- OpenAI, prompts, tools, model calls, embeddings, or knowledge retrieval.
- Public conversation creation, public chat UI, draft collection, customer confirmation, or customer replies.
- Public request creation and idempotent confirmation; those begin in Phase 4.
- Customer notification delivery, email, SMS, WhatsApp, or a claim that an information request was delivered.
- Public request-status lookup or verification challenges.
- Attachment upload, download signing, quotation upload, or storage-bucket changes.
- Site-visit scheduling records or UI.
- Quotation preparation/approval and financial decisions.
- Human-handoff queue behavior.
- Organization/member administration or multi-organization selection.
- General reporting, metrics, bulk actions, CSV export, or full-text search infrastructure.
- A general audit-log UI; mutation audit events remain queryable for future authorized tooling.
- Phase 4 request creation, Phase 5 AI, or any later roadmap work.

## Dependencies and assumptions

- Phase 0–2 remain green and the Phase 2 exactly-one-active-membership rule remains the active tenant-selection policy.
- Local Supabase and Docker are available for migration, RLS, and Auth/API integration tests.
- Employee API calls use the authenticated SSR Supabase client. The application must not use the service-role key for ordinary request management.
- Database functions used for multi-row mutations are version-controlled migrations, accept no caller-controlled organization ID, derive the actor from `auth.uid()`, and validate every target against the resolved active membership organization.
- BuildPro development fixtures are fictional and remain behind the existing explicit local-only seed guard.
- Dates are stored in UTC and formatted for the organization's configured timezone only at the UI boundary.
- Search is pilot-scale, case-insensitive matching over a bounded allowlist. PostgreSQL `pg_trgm` will not be enabled initially; add it only if measured query plans justify the extension and a migration/test documents the decision.
- Cursor pagination uses immutable tie-breaker `id` with `created_at`, both descending. No offset pagination is exposed.
- API IDs are UUIDs, limits are bounded (default 25, maximum 50), free text is trimmed and length-limited, and unknown query parameters may be ignored only if explicitly chosen and tested; malformed known parameters return `validation_error`.
- For record lookup, inaccessible and nonexistent request IDs map to the same public `not_found` response to avoid tenant-existence disclosure. Explicit `forbidden` is reserved for an authenticated employee who can see the request but lacks permission for the requested mutation.

## Design

### Layering and data flow

The Phase 3 flow follows the documented modular-monolith boundaries:

```text
Dashboard page or browser
  -> Next.js route handler / server-rendered page
  -> verified employee access context
  -> Zod input parser
  -> request application service
  -> organization-scoped repository or controlled database RPC
  -> Supabase PostgreSQL with forced RLS
  -> typed domain result
  -> employee DTO or sanitized HTTP error
```

Route handlers own HTTP parsing/status mapping. Services own workflow and authorization decisions. Repositories own database queries and require an organization ID plus the authenticated Supabase client. React components render DTOs and submit actions; they do not encode transition or authorization rules.

### Domain types and typed business results

Create closed TypeScript values for request type, status, priority, filters, sort cursor, assignment target, and Phase 3 permission. Derive runtime schemas from explicit literal lists and keep them aligned with database checks through tests.

Service outcomes use `Result<T, RequestServiceError>` (or equivalent discriminated unions) for expected states:

- `validation_error`
- `unauthenticated`
- `forbidden`
- `not_found`
- `conflict`
- `invalid_transition`
- `inactive_department`
- `inactive_member`
- `member_department_mismatch`
- `conversation_required`
- `internal_error`

Expected outcomes are not thrown. Unexpected adapter/database failures are normalized to `internal_error`, logged only with safe identifiers/trace context, and never expose SQL, RLS details, customer contact data, or tokens.

Define separate DTO families:

- `RequestListItem`: reference, title, request type, priority, status, service, department, assignee display name, customer display name, created/updated timestamps.
- `EmployeeRequestDetail`: list fields plus description, location, customer contact fields, customer-visible conversation messages, attachments metadata allowed for display (no signed URLs in this phase), current assignment, assignment history, status history, handoff summary, and permitted action descriptors.
- `EmployeeInternalRequestData`: internal notes and audit-relevant employee attribution, returned only when the caller has the dedicated permission.
- `CustomerSafeRequestData`: a deliberately smaller reusable mapper with no contact factor, internal note, employee-only reason, audit metadata, system/tool message, or storage path. Phase 3 tests it, but no public status endpoint is added.

Never build a customer response by deleting fields from an employee DTO. Construct each shape from an allowlist.

### Repository contracts

Introduce focused repository interfaces, avoiding a single generic CRUD repository:

- `RequestRepository.list(scope, query)` returns summaries plus `nextCursor`.
- `RequestRepository.findDetail(scope, requestId)` returns only a request visible under the caller's RLS/access scope.
- `RequestRepository.assign(scope, command)` invokes the controlled assignment transaction.
- `RequestRepository.transitionStatus(scope, command)` invokes the controlled transition transaction.
- `InternalNoteRepository.listForRequest(scope, requestId)` and `add(scope, command)`.
- `RequestInformationRepository.record(scope, command)` for the atomic customer-safe question/status/audit operation.
- Small lookup methods list active same-organization departments and assignable members for form options.

Every method requires an `EmployeeRequestScope` containing organization ID, member ID, role, and department ID from the verified server context. No repository method accepts organization scope from JSON, search params, route params, or hidden form fields.

The Supabase implementations must explicitly add organization filters even where RLS already applies. For multi-table write transactions, call narrowly granted authenticated database functions rather than a sequence of browser-visible writes.

### Request list API

Implement `GET /api/dashboard/requests` with:

- Required active authenticated employee context.
- Permission `requests:list`.
- Query schema: `status`, `departmentId`, `assignedMemberId`, `serviceId`, `search`, `cursor`, and `limit`.
- One value per filter for Phase 3; multi-select can be added later without silently changing semantics.
- Search trimmed to 2–100 characters (exact reference lookup may allow a single meaningful character only if justified); match reference, title, customer name, normalized phone, and location using a fixed query, never interpolated SQL.
- Response `{ items, nextCursor }` with no total count. Avoid expensive/count-leaking aggregate behavior.
- Sanitized 400, 401, 403, and 500 mappings in the repository error envelope with a generated trace ID.
- Cache prevention for tenant/customer data (`private, no-store`) and no static rendering.

The list query must apply access scope before filters/search and return only the minimum summary columns. Operational employees see personally assigned or same-department requests under the approved role policy; admins/managers see the organization. Viewer is denied request listing in Phase 3.

### Filtering and search

- Status values must be canonical request statuses.
- Department, employee, and service IDs must be UUIDs and resolve within the same organization.
- Filtering by an inaccessible or foreign target returns an empty list or sanitized validation/not-found result without confirming the foreign record exists.
- Search escapes wildcard characters and uses parameterized Supabase/database calls.
- Phone search normalizes permitted formatting server-side and never logs the query.
- Empty search is treated as absent; whitespace-only and oversized search are rejected or normalized consistently in schema tests.
- Index plans must be checked with representative development data. Existing status, department, assignee, service relationship, customer, and created-at indexes should be reused; add only indexes proven necessary by query shape.

### Cursor pagination

The stable sort is `(created_at DESC, id DESC)`. The next page predicate is:

```text
created_at < cursor.createdAt
OR (created_at = cursor.createdAt AND id < cursor.id)
```

Fetch `limit + 1`, return at most `limit`, and emit a versioned base64url cursor containing only validated `createdAt` and `id`. The cursor is a position, not an authorization token; every page independently reapplies session, tenant, RLS, role, and filters. Invalid version, malformed encoding, invalid timestamp/UUID, or oversized cursor returns `validation_error` rather than falling back to page one.

Cursor behavior must be deterministic for equal timestamps and tested for no duplicates/skips across adjacent stable pages. Document that concurrent inserts may appear on a later refreshed traversal; snapshot pagination is not required for the pilot.

### Request detail API

Implement `GET /api/dashboard/requests/{requestId}`:

- Validate UUID and active employee context.
- Require `requests:view` and RLS visibility for the specific request.
- Return `404 not_found` for both foreign-tenant and nonexistent/inaccessible records.
- Load related customer, service, department, assignee, allowed conversation messages, attachments metadata, active/historical assignments, status history, handoff summary, and internal notes only through separately authorized queries.
- Exclude system/tool messages, model metadata, attachment storage bucket/path, internal raw audit metadata, Auth user data, other tenant identifiers, and unrelated conversation records.
- Return chronological history/messages and explicit empty arrays where appropriate.
- Apply `private, no-store` and sanitized error responses.

### Dashboard request list

Add `/dashboard/requests` and navigation gated by `requests:list`.

The server-rendered first page uses the same service as the API or a shared application method, not duplicated data logic. Client interaction may update URL search parameters for filters/search/cursor and use the typed API for subsequent pages. The page includes:

- Search input with accessible label and submit/clear behavior.
- Status, department, service, and assignee filters populated only from allowed tenant data.
- Table on wider screens and readable responsive cards on narrow screens.
- Reference, customer, service, status, department/assignee, and received date.
- Accessible status text independent of color.
- Loading, empty-filter, recoverable error, expired-session, and forbidden states.
- Cursor-based next navigation; back navigation may use browser history in Phase 3 rather than reverse cursors.
- Links only to request IDs returned by authorized data.

Do not display counts or operational metrics unless implemented through separately scoped queries and added to this plan.

### Request detail page

Add `/dashboard/requests/[requestId]`, protected independently by `requests:view`. It displays:

- Customer/request summary and contact information allowed for employees.
- Service, description, location, priority, dates, department, and assignee.
- Customer-visible conversation excerpt when present.
- Attachment filenames/type/size only; no download action or storage path in Phase 3.
- Status timeline and assignment timeline.
- Internal notes in a visually separate employee-only section.
- Available actions derived from server permissions and transition eligibility.
- Forms for assignment, status transition, note creation, and request-more-information when authorized.
- Accessible pending, success, validation, conflict, stale-update, empty, and unexpected-error states.

The page must call server authorization even if its list link or action controls are hidden. After a mutation, revalidate the request page/list and render the result returned by the service.

### Assignment transaction

Implement `PATCH /api/dashboard/requests/{requestId}/assignment` and an equivalent reusable server-side service for the dashboard form.

Input:

- `departmentId`: UUID or null only when an employee assignment supplies the employee's active department.
- `memberId`: UUID or null.
- `reason`: optional trimmed 1–500 characters.
- `expectedUpdatedAt`: required ISO timestamp for optimistic conflict detection.

Rules:

- Require `requests:assign` and visibility of the request.
- Department must be active and in the actor's organization.
- Member must be active, in the same organization, have a recognized operational role, and belong to the selected department when a department is supplied.
- A deactivated member, foreign member, foreign department, member/department mismatch, or viewer target is rejected without revealing foreign details.
- At least one target is required. Assigning only a department clears the primary employee. Assigning an employee also records their department as the current department.
- The database transaction locks the request, verifies `expectedUpdatedAt`, ends the current assignment row, inserts one active assignment snapshot, updates `requests.department_id` and `assigned_member_id`, and inserts an append-only audit event.
- A no-op target returns the existing state without creating duplicate history, or returns a typed conflict; select one behavior before implementation and test it. Recommended: idempotent success with no new history.
- The unique partial active-assignment index remains the concurrency guard.

Role policy:

- `admin`, `manager`, and `commercial_officer` may assign visible requests.
- Other operational roles and `viewer` may not assign in Phase 3.
- A commercial officer remains constrained by request visibility; hidden UI is not enforcement.

### Status-transition validation and history

Create a pure transition module from the canonical graph in `docs/03_DOMAIN_AND_WORKFLOWS.md`. It returns allowed next statuses and explicit missing prerequisites. The API is `POST /api/dashboard/requests/{requestId}/status-transitions` with `newStatus`, optional bounded `reason`, and required `expectedUpdatedAt`.

Phase 3-supported transitions are:

- `new -> awaiting_customer_information | awaiting_assessment | unsupported | cancelled`
- `awaiting_customer_information -> new | inactive | cancelled`
- `inactive -> new | cancelled`
- `awaiting_assessment -> awaiting_customer_information | unsupported | cancelled`
- `unsupported -> closed`
- Any nonterminal status may move to `cancelled` only where the canonical rules permit; cancellation requires a reason.

The full canonical graph remains represented in the pure rule table, but transitions requiring Phase 6/7 or other missing evidence—quotation attachment, site-visit record, customer acceptance, project authorization, client validation, or administrative reopen—return `conflict` with a safe explanation until that evidence/workflow exists. Implementation must reconcile the exact supported subset with seeded end-to-end scenarios and record deviations.

Role policy:

- `admin` and `manager`: supported Phase 3 transitions for any visible organization request.
- `commercial_officer`: commercial intake transitions on visible requests.
- `technical_officer`: only technical transitions once such prerequisite-backed transitions are delivered; no additional Phase 3 transitions by default.
- `project_manager`: no Phase 3 transitions that imply project authorization/completion.
- `support_officer`: information/inactive/cancellation actions on visible support/complaint requests only if explicitly tested.
- `viewer`: read-only and denied mutations.

The controlled database function locks the request, checks optimistic version, validates the actor and target state again, sets transaction-local reason/source values, updates the request, and lets the status trigger append exactly one history row with previous status, new status, employee actor, reason, source `employee_dashboard`, and timestamp. It also writes an audit event without copying sensitive reason text into general metadata. Direct authenticated inserts/updates/deletes on history remain denied.

### Internal notes

Implement `POST /api/dashboard/requests/{requestId}/notes`:

- Schema-valid trimmed content between 1 and 4,000 characters.
- Require request visibility plus `requests:notes:create`.
- Author and organization come only from server access context.
- Insert through a controlled function or narrowly scoped policy that verifies the actor can access the request and is not a viewer.
- Record author and timestamp; do not allow author spoofing.
- Notes remain employee-only, are excluded from all customer-safe mappers/messages/model context, and are not logged.
- Notes are immutable in Phase 3. Editing/deleting notes requires a later explicit audited design even though the current table has `updated_at`.
- `admin`, `manager`, and operational officers with request access may add/read notes; `viewer` is denied note access in Phase 3.

### Request-more-information action

Implement `POST /api/dashboard/requests/{requestId}/request-information` with a trimmed `question` between 1 and 2,000 characters and `expectedUpdatedAt`.

The service requires request visibility and `requests:request_information`, verifies a linked open/nonclosed conversation, and atomically:

1. Locks the request and conversation.
2. Inserts a customer-visible `messages` row with `sender_type = 'employee'` and the server-resolved member ID; no internal metadata or delivery claim is stored.
3. Changes status to `awaiting_customer_information` when valid and not already there.
4. Records status history when a transition occurs.
5. Writes an audit event that records the action but not the question body.
6. Returns the persisted question and resulting request status.

If there is no linked conversation, the service returns `conversation_required`. Phase 3 does not synthesize a conversation because public conversation lifecycle belongs to Phase 4. If already awaiting information, a further question may be appended without duplicate status history, subject to authorization and optimistic concurrency. No customer notification/delivery record is created until its schema/provider contract exists in Phase 7.

### Authorization and permission strategy

Expand the closed permission list with:

- `requests:list`
- `requests:view`
- `requests:assign`
- `requests:status:update`
- `requests:notes:view`
- `requests:notes:create`
- `requests:request_information`

Recommended matrix:

| Role | List/view within RLS scope | Assign | Supported status updates | View/add notes | Request information |
| --- | --- | --- | --- | --- | --- |
| `admin` | Organization | Yes | Yes | Yes | Yes |
| `manager` | Organization | Yes | Yes | Yes | Yes |
| `commercial_officer` | Department/assigned | Yes | Commercial subset | Yes | Yes |
| `technical_officer` | Department/assigned | No | None in initial subset | Yes | Yes |
| `project_manager` | Department/assigned | No | None in initial subset | Yes | Yes |
| `support_officer` | Department/assigned | No | Restricted support subset | Yes | Yes |
| `viewer` | No request access in Phase 3 | No | No | No | No |

The permission module controls presentation and service prechecks. RLS/database functions independently enforce organization, membership activity, request scope, role, and target validity. Deactivation must invalidate the next API/page/action even with an unexpired Auth session.

### Customer-safe and employee-only separation

- Customer contact/project data appears only in authenticated employee DTOs and future explicitly verified customer DTOs.
- Internal notes, audit metadata, employee-only reasons, assignment reasons, Auth data, and system/tool messages never enter `CustomerSafeRequestData`.
- Request-more-information questions are customer-visible messages; note content is never reused as a customer question.
- Attachment storage path/bucket and signed URL are absent from Phase 3 API responses.
- Search results contain only summary fields and no message/note snippets.
- API tests serialize each response and assert forbidden keys/content are absent, not merely hidden in React.

## Database changes

Add one forward-only Phase 3 migration after the existing hardening migration. It should:

1. Add nullable `department_id` to `assignments` with a composite tenant foreign key.
2. Make `assignments.member_id` nullable and add a check requiring `department_id` or `member_id`; preserve the one-active-assignment index.
3. Backfill `assignments.department_id` from each member's department and then from the request department where needed before validating the new check.
4. Add status-history provenance columns (`changed_by_type`, `source`) with safe defaults/backfill and bounded checks.
5. Add bounded checks for assignment reason, status-history reason, and internal-note content if existing constraints are insufficient.
6. Replace the status-history trigger/function so every insert/status change records correct employee provenance and a controlled reason/source exactly once.
7. Add narrowly scoped authenticated database functions for assignment, status transition, note insertion, and request-information recording. Revoke execute from `public`/`anon`; grant only exact signatures to `authenticated`.
8. Harden direct table privileges/policies so authenticated clients cannot bypass services to update request assignment/status fields or forge assignment, history, message, note, or audit rows.
9. Expand read policies only as needed for employee detail: customer/message/note reads must follow `can_access_request`/conversation scope and approved role restrictions.
10. Refine `private.can_access_request` or add purpose-specific helpers if the approved Phase 3 role matrix cannot be expressed safely by the current helper.
11. Add query indexes only for concrete list/cursor/history access patterns not already covered—for example `(organization_id, created_at desc, id desc)` and matching tie-breaker indexes for status/department/assignee filters if query plans need them.
12. Preserve forced RLS, tenant immutability, append-only history/audit triggers, reference generation, restrictive deletion behavior, and anonymous denial.

Do not edit prior applied migrations. Regenerate `lib/supabase/database.types.ts` after the migration and fail CI on drift.

## API contracts and HTTP mapping

Create these Phase 3 routes:

```text
GET   /api/dashboard/requests
GET   /api/dashboard/requests/[requestId]
PATCH /api/dashboard/requests/[requestId]/assignment
POST  /api/dashboard/requests/[requestId]/status-transitions
POST  /api/dashboard/requests/[requestId]/notes
POST  /api/dashboard/requests/[requestId]/request-information
```

All routes:

- Resolve verified employee context server-side.
- Parse route, query, and JSON inputs with schemas before services.
- Do not accept `organizationId`, actor/member identity, role, status history actor, or author from the client.
- Return the documented error envelope with generated trace ID.
- Use `401` unauthenticated, `403` known-but-not-permitted action, `404` inaccessible/missing record, `409` stale write/invalid transition/business conflict, `400` invalid input, and `500` sanitized unexpected failure.
- Set tenant-data responses to private/no-store and avoid logging request bodies.
- Reject unsupported content types and oversized JSON bodies through a bounded parsing helper where practical.

Mutation responses return the updated minimal DTO and may use `201` for a new note/message, otherwise `200`. They must be safe under double submission through optimistic concurrency and no-op/idempotency behavior.

## Milestones

### Milestone 1: domain, authorization, and schema foundation

- Add closed request/status/filter/cursor schemas and pure transition rules.
- Expand Phase 2 permissions with the approved matrix.
- Add the Phase 3 migration, transaction functions, RLS/policy hardening, indexes, and pgTAP tests.
- Regenerate database types.
- Update the guarded development fixture with an employee-processable request graph; do not add operational data to production seed.

### Milestone 2: repositories, services, and APIs

- Implement tenant-required repository contracts and Supabase adapters.
- Implement typed list/detail/assignment/status/note/information services.
- Add customer-safe and employee DTO mappers.
- Add all authenticated request API routes and standardized HTTP result mapping.
- Add unit and service/API integration tests before UI integration.

### Milestone 3: dashboard request workflow

- Add request navigation permission.
- Implement request list filters, search, cursor navigation, loading/error/empty states, and responsive presentation.
- Implement independently protected request detail with histories and separated internal notes.
- Add assignment, status, internal-note, and request-information forms using the same services/contracts.
- Verify direct URLs and direct API calls independently of hidden controls.

### Milestone 4: security tests, hardening, and documentation

- Complete local Auth/API and cross-tenant negative tests.
- Test concurrency, stale writes, double submissions, response-field allowlists, and deactivation.
- Run all quality, database, type-generation, build, clean-checkout, and secret checks.
- Update README, project tree, ADRs, this plan, and CI if the new integration harness requires it.
- Review the final diff and ensure no Phase 4 or later feature was introduced.

## File changes

Expected files to create (exact splits may be simplified if no empty abstraction is created):

```text
app/api/dashboard/requests/route.ts
app/api/dashboard/requests/[requestId]/route.ts
app/api/dashboard/requests/[requestId]/assignment/route.ts
app/api/dashboard/requests/[requestId]/status-transitions/route.ts
app/api/dashboard/requests/[requestId]/notes/route.ts
app/api/dashboard/requests/[requestId]/request-information/route.ts
app/dashboard/requests/page.tsx
app/dashboard/requests/loading.tsx
app/dashboard/requests/error.tsx
app/dashboard/requests/[requestId]/page.tsx
app/dashboard/requests/[requestId]/loading.tsx
app/dashboard/requests/[requestId]/error.tsx
components/requests/request-list.tsx
components/requests/request-filters.tsx
components/requests/request-detail.tsx
components/requests/request-actions.tsx
lib/domain/requests.ts
lib/domain/request-transitions.ts
lib/schemas/request-api.ts
lib/dto/request-dto.ts
lib/repositories/request-repository.ts
lib/repositories/supabase-request-repository.ts
lib/repositories/internal-note-repository.ts
lib/services/request-service.ts
lib/services/request-authorization.ts
lib/http/api-response.ts
supabase/migrations/<timestamp>_phase_3_request_management.sql
supabase/tests/006_request_management.sql
tests/unit/requests/request-transitions.test.ts
tests/unit/requests/request-schemas.test.ts
tests/unit/requests/request-cursor.test.ts
tests/unit/requests/request-dto.test.ts
tests/unit/requests/request-authorization.test.ts
tests/integration/requests/request-services.test.ts
tests/integration/requests/request-api.test.ts
scripts/test-request-routes.mjs
```

Expected files to modify:

```text
lib/auth/permissions.ts
lib/supabase/database.types.ts
components/dashboard/dashboard-navigation.tsx
package.json
supabase/seeds/development.sql
.github/workflows/ci.yml                 # only if a separate runner/script is needed
README.md
PROJECT_TREE.txt
docs/11_DECISIONS.md
docs/plans/phase-3-request-management.md
```

Do not create a production dependency unless implementation demonstrates a concrete need. The current stack is sufficient for schemas, services, APIs, and UI.

## Security review

### Authentication and tenant isolation

- Every page, route, service, repository, and database function derives organization/member/role from the verified session and active membership.
- Never trust organization, actor, author, role, or current status supplied by the browser.
- Repositories require organization scope and add explicit organization filters even under RLS.
- Database functions derive the organization from the accessible request plus `auth.uid()`, validate membership again, and lock rows before mutation.
- Anonymous/public table access remains denied. No Phase 3 endpoint is public.
- Foreign-tenant and nonexistent IDs return indistinguishable not-found responses where existence disclosure is a risk.
- Service-role credentials remain unused in browser/application request management. Any test-only local service key is obtained from the local CLI and never committed or sent to the application client.

### Authorization

- Permission checks are server-side and duplicated at the RLS/database mutation boundary.
- UI controls reflect permissions but never grant them.
- Direct URL and direct API tests cover every action for denied roles.
- Employee assignment validates active same-tenant membership, recognized role, and department relationship.
- Deactivated actors and targets are rejected on the next request.
- Optimistic timestamps plus row locks prevent stale concurrent mutation from silently overwriting a newer state.

### Customer and employee data

- Employee and customer-safe DTOs are separate allowlist mappers.
- Internal notes, audit metadata, assignment reasons, and employee-only history fields cannot enter customer shapes.
- Customer contact details do not appear in list search logs, errors, trace data, or unauthorized responses.
- Conversation queries exclude system/tool content and metadata.
- Attachment storage paths and any future signed URLs are absent.

### Input, output, and abuse safety

- Zod validates UUIDs, statuses, dates, cursor structure, limits, search, reasons, questions, and note lengths.
- Queries remain parameterized; wildcard escaping and fixed search fields prevent query-shape injection.
- Error messages are sanitized and include trace IDs without raw Supabase/SQL details.
- `Cache-Control` prevents shared caching of tenant data.
- Basic authenticated endpoint rate limiting is not introduced unless repository infrastructure exists; bounded pagination/body/search limits constrain obvious abuse. Broader rate limiting remains Phase 9.

### Audit integrity

- Status, assignment, request-information, and note actions write audit/history in the same database transaction as the state change.
- History/audit tables remain append-only for authenticated roles.
- Actor IDs come from current membership, not form data.
- Audit events store action identifiers and safe metadata, not note/question bodies or full customer content.

## Test plan

### Unit tests

- Every canonical status is present once in the transition table.
- Valid supported transitions succeed; invalid skips such as `new -> completed` fail.
- Prerequisite-dependent transitions fail with explicit safe reasons when evidence is absent.
- Role/action permission matrix is exhaustive and unknown values deny.
- List/detail/mutation schemas accept valid input and reject invalid UUIDs, enums, lengths, limits, timestamps, and bodies.
- Cursor encode/decode round-trips; malformed, oversized, old-version, bad timestamp, and bad UUID cursors fail.
- Cursor comparison handles identical timestamps using the ID tie-breaker.
- DTO mappers include approved fields and exclude internal notes/audit/storage/system/tool fields from customer-safe shapes.
- Repository/service expected failures return typed results rather than uncaught exceptions.
- Assignment rules reject inactive, foreign, viewer, and department-mismatched targets.
- Request-information rules handle missing/closed conversations and already-awaiting status.

### Database and RLS tests

- Schema additions, backfills, checks, foreign keys, indexes, function ownership/search paths, and grants are correct.
- Anonymous roles cannot select or mutate request-management tables/functions.
- Active admin/manager access organization requests; operational roles see only assigned/same-department requests; viewer behavior matches the approved matrix.
- Organization A cannot list, search, filter, detail, assign, transition, note, or request information on organization B.
- A crafted organization/member/department ID cannot cross tenant boundaries.
- A deactivated actor cannot read or mutate; a deactivated/foreign target cannot be assigned.
- Direct table updates cannot bypass status/assignment functions or forge history/audit authors.
- Assignment function ends one active row and creates one new active row atomically; concurrent attempts preserve the unique active-assignment invariant.
- Status function creates exactly one append-only history row with correct actor/reason/source; invalid/stale transitions create none.
- History and audit updates/deletes remain rejected.
- Notes cannot be authored as another member and are unavailable to viewer/foreign tenant.
- Request-information message contains the authenticated employee actor and correct conversation/request tenant; no partial state remains after failure.
- Existing reference, RLS, attachment, seed, and migration hardening tests continue to pass.

### Service and repository integration tests

- List applies tenant/access scope before filters and search.
- Each filter and combined filters return the expected rows.
- Search matches only approved fields and does not leak notes/messages/foreign customers.
- Two cursor pages have stable order with no duplicates/skips for equal timestamps.
- Detail returns the complete allowed graph and empty-safe arrays.
- Foreign/missing/inaccessible request detail maps uniformly to not found.
- Assignment succeeds for an authorized same-tenant active target and rejects all invalid targets.
- Concurrent/stale assignment and status submissions return conflict and preserve the winning state/history.
- Status transition and audit are atomic.
- Note creation stores the authenticated author; content does not enter logs/customer DTOs.
- Request-information question/status/message/audit commit atomically, and conversation-required failure commits nothing.
- Database adapter errors normalize to safe typed failures.

### HTTP and page authorization tests

- Unauthenticated list/detail/mutation routes return 401 or safe authentication redirect as appropriate.
- Expired/malformed sessions fail closed.
- Deactivated members lose API/page access with the same session.
- Direct organization-B request URLs and API calls reveal no organization-B content.
- Viewer and unauthorized operational roles cannot mutate by calling endpoints directly.
- Hidden navigation/action buttons do not affect server enforcement.
- Invalid JSON/content type/query/cursor returns sanitized validation errors.
- API responses have private/no-store headers and contain no forbidden keys.
- Dashboard list covers populated, filtered-empty, loading, and recoverable-error states.
- Detail covers missing request, empty histories/notes/conversation, and permitted action states.

### Cross-tenant negative-test scenarios

At minimum, create organizations A and B, active employees with comparable roles, departments, customers, requests, conversations, and assignment targets. Prove:

1. A's employee cannot list B's request, including via search for B's exact reference/customer phone.
2. A's employee cannot retrieve B's detail by UUID.
3. A cannot filter using B's department, service, or employee to infer B data.
4. A cannot assign A's request to B's department/member or B's request to A's member.
5. A cannot transition B's request, even when supplying B's current timestamp/status.
6. A cannot add/read notes on B's request.
7. A cannot create a request-information message on B's conversation/request.
8. A cannot read B's customer, conversation messages, histories, assignment reasons, handoff, or attachment metadata through joins.
9. A forged organization ID in body/query is rejected or ignored and never changes scope.
10. Failed cross-tenant mutations create no history, audit event, message, or partial assignment row.

## Development sample-data strategy

Keep `supabase/seed.sql` production-safe and unchanged unless a configuration-only correction is required. Extend only `supabase/seeds/development.sql`, still excluded from automatic seed paths and guarded by `ALLOW_LOCAL_SAMPLE_DATA=true`, with fictional:

- Requests across multiple statuses, services, departments, assignee states, and equal timestamps for pagination tests.
- A conversation and customer-visible messages for request-information tests.
- Assignment/status/note history representative of the Phase 3 UI.
- A second tenant only when needed for local manual isolation checks; automated tests should create and roll back their own fixtures.

Do not place Auth credentials or hosted user IDs in seed SQL. Auth integration runners provision temporary local users and delete them after testing. The development seed must continue refusing non-loopback/hosted targets.

## Migration and rollback safety

- Use one additive, forward-only Phase 3 migration; never modify the four applied Phase 1 migrations.
- Backfill new nullable columns before adding/validating stricter constraints.
- Inspect existing rows for constraint violations before `NOT VALID` constraints are validated.
- Replace functions/policies in a transaction and preserve deny-by-default behavior at every step.
- Avoid dropping customer/request/history data, destructive type conversions, broad grants, or disabling RLS.
- Use explicit function signatures for revoke/grant and fixed `search_path` on all database functions.
- Test reset from empty, migration from a Phase 2 database with existing sample/history rows, and repeatable generation of database types.
- Rollback in development is a database reset to version-controlled migrations. Hosted rollback is a new compensating migration; never run ad hoc destructive SQL or edit migration history.
- Before hosted apply, run `supabase db diff`/migration review and make a backup. After apply, run smoke/RLS checks with temporary tenant fixtures and remove them.

## Commands to run during implementation

Repository inspection and dependencies:

```bash
git status --short
npm ci
npm run format:check
```

Local database and generated types:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types:check
ALLOW_LOCAL_SAMPLE_DATA=true npm run db:seed:development
npm run db:stop
```

Application quality:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Run the repository-owned request route/Auth integration command added during implementation, preferably through `npm run db:test` or a clearly named script such as:

```bash
node scripts/test-request-routes.mjs
```

Clean-checkout verification:

```bash
git clone <repository-url> <disposable-directory>
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

The disposable checkout must also run database/request integration tests when Docker is available. Record actual commands and results in completion notes; never claim unexecuted checks passed.

## Acceptance criteria

- [x] An authenticated authorized employee can list only requests visible within their active organization/request scope.
- [x] Status, department, assignee, service, and bounded search filters work alone and together without leaking inaccessible records.
- [x] Cursor pagination is stable, bounded, validates malformed cursors, and produces no duplicate/skip in fixed-data tests.
- [x] An authorized employee can open request detail with allowed customer/conversation/attachment metadata, assignment history, status history, and role-permitted internal notes.
- [x] Employee-only notes, audit metadata, system/tool messages, and storage paths are absent from customer-safe and unauthorized responses.
- [x] Department-only assignment and same-tenant active employee assignment are atomic and historically recorded.
- [x] Foreign, inactive, viewer, or department-mismatched assignment targets are rejected without partial writes.
- [x] Supported status transitions succeed; invalid, stale, and missing-prerequisite transitions return typed conflicts and create no history.
- [x] Every successful status change records one append-only history row with actor, previous/new status, reason, source, and UTC timestamp.
- [x] Authorized employees can add immutable internal notes with server-derived authors; unauthorized/viewer/cross-tenant users cannot read or write them.
- [x] The request-more-information action stores a customer-safe employee question, changes status when valid, and audits atomically for linked conversations; it never falsely claims delivery.
- [x] Request list/detail/mutation APIs validate all inputs, return sanitized typed errors/trace IDs, prevent shared caching, and never accept caller-supplied tenant/actor/role.
- [x] Pages and API routes independently authorize direct access; hidden controls are never the security boundary.
- [x] Deactivated employees fail on the next request, and service-role credentials are absent from browser/application request-management code.
- [x] Anonymous and public clients cannot list or retrieve customers, requests, notes, histories, or employee data.
- [x] Cross-tenant negative tests cover list, search, detail, assignment, status, notes, request information, joins, and partial-write absence.
- [x] Development operational fixtures remain explicit, local-only, fictional, and impossible to apply accidentally through normal production seeding.
- [x] Database reset/migration, lint, pgTAP/RLS/Auth/API integration, type generation, lint, formatting, strict typecheck, unit tests, and production build pass.
- [x] README, project tree, ADRs, permissions, API behavior, schema types, CI, and this execution plan accurately describe the delivered Phase 3 boundary.
- [x] No OpenAI, public chat, public request creation, customer reply/delivery, attachment upload, quotation, or later-phase feature is introduced.

## Progress log

- [x] Read `AGENTS.md`, `.agent/PLANS.md`, and `docs/00_INDEX.md`.
- [x] Read all user-requested product, journey, domain, architecture, schema, API, security, and testing documents.
- [x] Read the roadmap and decision log required by the documentation index for large-feature planning.
- [x] Inspect the current repository, scripts, dependencies, strict TypeScript/test/CI setup, Phase 2 authentication/permissions, Supabase schema, RLS, migrations, generated types, and development seed.
- [x] Reconcile Phase 3 requirements with the actual assignment, status-history, notification, and conversation schema.
- [x] Create the Phase 3 execution plan only; no implementation performed.
- [x] Review and approve the plan before implementation.
- [x] Milestone 1: domain, authorization, and schema foundation.
- [x] Milestone 2: repositories, services, and APIs.
- [x] Milestone 3: dashboard request workflow.
- [x] Milestone 4: security tests, hardening, documentation, and clean lockfile verification.
- [x] Record actual implementation commands, results, deviations, hosted steps, and limitations in completion notes.

## Decision log

- 2026-08-07: Phase 3 remains an authenticated employee-only slice. No public endpoint, customer chat, OpenAI call, storage operation, or service-role application path is introduced.
- 2026-08-07: Request repositories require an explicit server-resolved employee scope and still add organization filters under RLS.
- 2026-08-07: Multi-row mutations use narrowly granted authenticated database functions for atomicity. They derive the actor/tenant from Auth and do not accept caller-selected tenant identity.
- 2026-08-07: List pagination uses `(created_at DESC, id DESC)` with versioned opaque cursors and no total count.
- 2026-08-07: Pilot search uses bounded parameterized matching without a new PostgreSQL extension; performance evidence is required before adding `pg_trgm`.
- 2026-08-07: Employee and customer-safe DTOs are independent allowlists. Internal notes are never obtained by stripping fields from an employee response.
- 2026-08-07: Assignment history is migrated to record department and/or member so department-only routing is representable and auditable.
- 2026-08-07: Status provenance is added in a forward migration, and controlled transitions write state plus one append-only history record atomically.
- 2026-08-07: Viewer receives no request access in Phase 3 because no product requirement defines customer-data visibility for that role. Expansion requires an explicit later decision.
- 2026-08-07: The Phase 3 request-information action records the employee-side question only for an existing linked conversation. Customer delivery/reply and notification providers remain Phase 4/7 work.
- 2026-08-07: Canonical transitions whose evidence belongs to later phases fail closed until the corresponding records and authorization workflow exist.
- 2026-08-07: The post-implementation security audit replaced source-status authorization with an explicit role/transition-pair allowlist in both the application service and database transaction. Phase 3 allows only intake/information/unsupported/inactive/cancellation transitions; evidence-dependent site-visit, quotation, project, completion, and reopen transitions fail closed. Support officers are additionally restricted to support and complaint requests; technical officers and project managers receive no Phase 3 status transitions.
- 2026-08-07: The audit hardening also rejects PostgREST filter control characters, limits mutation JSON bodies, distinguishes access-resolution failures from authorization denial, adds a recoverable list error action, and expands cross-tenant mutation, pagination, filter, body-limit, and UI-state tests.
- 2026-08-07: Existing `updated_at` values provide optimistic concurrency for assignment, transition, and request-information mutations; the database additionally locks the request row before validating and writing.
- 2026-08-07: Phase 3 uses one Supabase request repository implementation with focused methods instead of separate note/information adapter classes. This keeps all database access in the repository layer without creating empty abstractions.

## Known risks and limitations

- Viewer remains dashboard-shell-only and receives no request data. Expanding that role requires an explicit product decision.
- The current exact-one-membership Phase 2 policy prevents employees with multiple legitimate tenant memberships from entering the dashboard; Phase 3 does not add tenant switching.
- Customer delivery and replies for request-more-information are intentionally absent. The action is stored but must not be presented as delivered.
- Requests without conversations cannot use request-more-information until Phase 4 supplies a conversation lifecycle.
- Site visits, quotations, customer acceptance, project authorization, completion confirmation, and administrative reopen lack required evidence models; related transitions remain unavailable.
- Search uses pilot-scale bounded matching and may need `pg_trgm` or a search vector after representative production volumes are measured.
- Cursor traversal is stable for a fixed data set but not a database snapshot; concurrent changes can alter later pages.
- Attachment metadata may be displayed, but private file access is not implemented until Phase 6.
- The current schema has no general row version. `updated_at` supplies optimistic concurrency for Phase 3; a dedicated monotonic version may be warranted if timestamp precision proves insufficient.
- Rate limiting and structured observability are not yet repository-wide infrastructure. Phase 3 constrains inputs and avoids sensitive logging; full controls remain Phase 9.
- Hosted migration and Auth/API smoke checks require deployment credentials and remain manual until the implementation is approved and complete.

## Completion notes

Post-audit correction on 2026-08-07: all Phase 3 audit findings were addressed without adding Phase 4 functionality. Workflow enforcement now matches the supported subset documented by this plan and is duplicated at the service/database security boundaries. Search and request-body parsing were hardened, access failures retain correct HTTP semantics, and regression coverage now includes evidence-dependent denial without history/audit writes, explicit foreign-tenant list/mutation negatives, equal-timestamp cursor traversal, combined filters, oversized bodies, and rendered empty/invalid-filter states.

Post-audit verification: `npm run db:reset` passed from all version-controlled migrations; `npm run db:lint` passed with no schema errors; `npm run db:test` passed twice consecutively without an intervening reset (83 pgTAP assertions, 20 concurrent unique references, 12 Auth/RLS checks, 9 protected-route checks, and 29 request-route checks); `npm run lint`, `npm run typecheck`, `npm test` (12 files, 39 tests), and `npm run build` all passed. The repeat run also corrected an older reference-counter assertion so the database test suite remains valid after prior concurrency allocations.

Implemented Phase 3 without starting Phase 4. Delivered migration `20260807000200_phase_3_request_management.sql`, forced-RLS/privilege hardening, atomic request mutation functions, generated types, request domain rules/schemas/DTOs, a Supabase repository, typed application service, six employee APIs, request list/detail dashboard states and actions, guarded sample conversation data, unit tests, pgTAP security tests, and an authenticated HTTP route runner.

Final verification on 2026-08-07:

- `npm ci` — passed: 404 locked packages installed.
- `npm run format:check` — passed.
- `npm run lint` — passed with zero errors.
- `npm run typecheck` — passed under strict TypeScript.
- `npm test` — passed: 11 files, 35 tests.
- `npm run build` — passed; six request APIs plus request list/detail routes compiled as dynamic server routes.
- `npm run db:reset` — applied all five migrations and production-safe seed; the local CLI intermittently returned an undefined wrapper exit after restart, so migration/seed success was independently confirmed by subsequent schema/tests.
- `npm run db:lint` — passed with no schema errors.
- `npx supabase test db` — passed: 6 files, 79 pgTAP assertions.
- `node scripts/test-reference-concurrency.mjs` — passed: 20 unique concurrent references.
- `node scripts/test-employee-auth.mjs` — passed: 12 Auth/RLS checks.
- `node scripts/test-auth-routes.mjs` — passed: 9 protected-route checks.
- `node scripts/test-request-routes.mjs` — passed: 14 request API/authorization checks.
- `ALLOW_LOCAL_SAMPLE_DATA=true npm run db:seed:development` — passed after wrapping reciprocal request/conversation inserts in one deferred transaction.
- `npm run db:types` — passed; two generations produced identical SHA-256 `8ad545428c93b5b67127a4da2a527283f2570199704e943e785302dce5fb65a9`.

Implementation deviations: the focused note and request-information repository operations live as methods on one request repository rather than empty standalone adapters. The full customer delivery/reply path for request-more-information remains deferred and the UI states that recording a question does not deliver it. Hosted migration application and hosted Auth smoke tests remain manual deployment work.

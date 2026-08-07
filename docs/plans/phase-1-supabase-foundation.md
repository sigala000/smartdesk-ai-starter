# Plan: Phase 1 Supabase foundation

## 1. Goal

Establish a reproducible local Supabase project and a version-controlled PostgreSQL foundation for SmartDesk AI. The completed phase will provide the complete MVP data model, transaction-safe request references, conservative role-aware Row Level Security (RLS), deterministic BuildPro Cameroon configuration seed data, isolated development fixtures, generated TypeScript database types, and automated migration and cross-tenant security tests.

Phase 1 creates database foundations only. It does not expose public APIs, implement application workflows, build authentication screens, create storage buckets, or begin any customer or employee UI.

## 2. Current repository state

As inspected on 2026-08-06:

- Phase 0 is complete at commit `077453a` on `main`, synchronized with `origin/main`.
- The repository contains a minimal Next.js 16.3.0 App Router shell, strict TypeScript, ESLint, Prettier, Vitest, environment validation, shared result/error types, and pinned GitHub Actions CI.
- `package.json` provides `dev`, `lint`, `format`, `format:check`, `typecheck`, `test`, and `build`; there are no database or Supabase scripts.
- Vitest currently discovers `tests/**/*.test.ts` in the Node environment. It has only Phase 0 unit tests.
- `.env.example` lists public Supabase URL/anon key and server-only service-role key as optional placeholders. The server-only environment module is imported by the root server layout.
- There is no `supabase/` directory, Supabase CLI configuration, migration, seed, generated database type, Supabase package, database test, or Supabase client module.
- No database or storage infrastructure exists locally in the repository.
- The required documents exist and were read. `docs/07_API_CONTRACTS.md` was also read because `docs/00_INDEX.md` requires it for database/backend work.

Material documentation ambiguities and their conservative plan resolutions:

- `docs/05_DATABASE_SCHEMA.md` specifies uniqueness on `(organization_id, idempotency_key)` but omits the `idempotency_key` field. Add `idempotency_key uuid not null` to `requests`; this is necessary for the documented creation transaction and AC-04.
- The customer schema recommends unique `(organization_id, phone_e164)` but also says phone numbers may be shared. Do not add that unique constraint; add a lookup index instead. Deduplication and merging remain application decisions.
- `conversations.request_id` and `requests.conversation_id` form a reciprocal nullable relationship. Retain both documented fields, add the second foreign key after both tables exist, and enforce reciprocal values with deferred constraint triggers so request-creation transactions can update both sides atomically.
- Security requires broader audit coverage than `request_status_history` alone provides. Add an `audit_events` tenant table for administrative, knowledge, handoff, and override events; domain-specific history tables remain the authoritative structured histories.
- Role permissions are not fully enumerated. Phase 1 uses a conservative deny-by-default matrix defined below. Later feature plans may expand access only with explicit authorization tests and a recorded decision.

These are non-blocking because each resolution preserves the higher-precedence workflow and security requirements without granting broader access.

## 3. Scope

- Add pinned Supabase CLI tooling suitable for local development and CI.
- Add local Supabase configuration without production credentials.
- Represent every database object through ordered SQL migrations.
- Create the tenant, employee membership, customer, conversation, request, workflow, support, content, notification, feedback, audit, and reference-counter tables defined below.
- Add primary keys, composite tenant keys, foreign keys, deletion behavior, checks, indexes, and timestamp/immutability triggers.
- Add transaction-safe request-reference generation without `SELECT MAX(...) + 1`.
- Enable RLS on every table exposed through Supabase's API schemas.
- Revoke broad anonymous access and add conservative authenticated policies.
- Add private helper functions for membership and role checks without causing recursive RLS evaluation.
- Seed BuildPro Cameroon configuration deterministically for local development.
- Keep representative customers, requests, messages, and users in a separate explicitly development-only fixture.
- Generate and check in strict TypeScript database types.
- Add SQL migration, constraint, reference-concurrency, RLS, and cross-tenant negative tests.
- Add package scripts and documentation for starting, resetting, testing, and generating types from local Supabase.

## 4. Out of scope

- Employee login UI, cookie/session integration, membership resolution in Next.js, protected routes, or role-aware navigation; these belong to Phase 2.
- Request repositories, application services, API routes, workflow transition services, dashboard pages, assignment UI, or internal-note UI; these belong to Phase 3.
- Public conversation endpoints, chat, message orchestration, structured draft behavior, or request-creation application services; these belong to Phase 4.
- OpenAI SDKs, prompts, tools, embeddings, or vector search; these belong to Phase 5 or a later approved knowledge phase.
- Supabase Storage buckets, file upload policies, signed URLs, or file inspection; these belong to Phase 6. Phase 1 creates attachment metadata only.
- Handoff APIs, queues, ownership behavior, or notifications providers; these belong to Phase 7. Phase 1 creates their records only.
- Status-verification challenges and tokens; these belong to Phase 8.
- Production deployment, backups, retention execution, monitoring, rate limiting, or real customer data.
- Broad `anon` table policies or direct public-table writes. Future public chat operations must use controlled server endpoints or narrowly scoped, separately reviewed functions.
- Application use of the service-role key. Phase 1 may use it only in local test setup; future application use remains server-only and explicitly tenant-scoped.

## 5. Dependencies and assumptions

- Docker or another Supabase-supported local container runtime is installed and running for implementation and CI database tests.
- Add the `supabase` CLI as an exact dev dependency and invoke it through npm scripts; do not rely on an unpinned global CLI.
- Add `@supabase/supabase-js` only if needed by the TypeScript integration-test harness or typed-access smoke test. Do not add `@supabase/ssr` until Phase 2 needs session/cookie integration.
- Local Supabase supplies PostgreSQL, Auth, and API services. Phase 1 tests run against the local instance, never a shared or production project.
- Use PostgreSQL `gen_random_uuid()` available in the supported local PostgreSQL version. Do not add `uuid-ossp` merely for UUID defaults.
- Do not enable `pgvector`, `pg_trgm`, `citext`, or other production extensions in Phase 1. No current requirement needs them. SQL tests may create `pgtap` inside a transaction and roll it back if `supabase test db` requires it; this does not become a production migration.
- Use text columns plus named check constraints for evolving workflow values instead of PostgreSQL enum types, which are harder to change safely.
- All tenant child relations use composite foreign keys containing `organization_id`, not only UUID foreign keys, to make cross-tenant references impossible at the database layer.
- `organizations` is the tenant root and therefore does not contain its own `organization_id`. Every other application-owned table does.
- `auth.users` remains Supabase-owned. `organization_members.user_id` references `auth.users(id)` but no migration modifies the Auth schema.
- The Phase 1 RLS matrix is intentionally restrictive. Absence of a policy means denial.
- BuildPro configuration seed data is safe fictional data but is not deployed by migrations. Production tenant onboarding will use a later controlled process.
- The existing environment schema remains optional for ordinary Phase 1 builds; local database test commands obtain values from `supabase status` or a test-only ignored environment file. No service-role value is added to browser-safe code.

## 6. Proposed schema

Use `public` for API-visible application tables and a non-exposed `private` schema for authorization helpers and internal reference-generation functions. Explicitly set function `search_path` values and revoke public execution where appropriate.

Conventions:

- UUID primary keys default to `gen_random_uuid()`.
- Timestamps use `timestamptz`, default to `now()`, and are stored in UTC.
- Mutable tables use `created_at` and `updated_at`, with a common trigger to update `updated_at`.
- Tenant-owned tables include `organization_id uuid not null` and a unique `(organization_id, id)` key to support composite tenant foreign keys.
- JSON columns use `jsonb`, explicit defaults, and object/array shape checks where feasible.
- Status and role values use text with named checks.
- RLS is enabled and forced where compatible with Supabase ownership/administration requirements; tests verify actual behavior for `anon` and `authenticated` roles.
- Tenant identity is immutable after insert. A trigger rejects changes to `organization_id`.
- Tables are schema-qualified in migrations, functions, triggers, and tests.

Additional technical tables:

- `request_reference_counters` stores the last allocated value per organization and calendar year.
- `audit_events` provides append-only coverage for important actions not represented by a dedicated history table.

## 7. Tables and relationships

### organizations

Tenant root with the documented identity, contact, timezone, language, reference prefix, active flag, and timestamps. `slug` and `reference_prefix` are globally unique after normalized lowercase/uppercase checks.

### departments

Belongs to an organization. Names are unique within the organization. Deactivation is preferred to deletion.

### services

Belongs to an organization and optionally a department in the same organization. Includes code, display information, JSON required-field configuration, active flag, and timestamps.

### organization_members

Links `auth.users` to an organization and optionally a same-tenant department. The `(organization_id, user_id)` pair is unique. Roles are limited to the documented initial role set. Deactivation revokes policy access immediately.

### customers

Belongs to an organization. Stores the minimum documented identity/contact fields. Phone is indexed but not unique because shared contact numbers are permitted.

### conversations

Belongs to an organization; optionally links a same-tenant customer, request, and assigned member. Stores the web channel, state, intent, structured collected/confirmed fields, summary, and timestamps. External conversation identity is unique only when present and scoped to organization plus channel.

### messages

Belongs to an organization and conversation; optionally links a same-tenant sender member. Stores sender type, content, provider ID, model metadata, and timestamp. Provider IDs are unique only when present and tenant-scoped. A client message ID should be represented in metadata only temporarily or, preferably, by a dedicated `client_message_id uuid null` column with a partial unique `(conversation_id, client_message_id)` index to support the documented public-message idempotency requirement; this plan includes the dedicated column.

### requests

Belongs to an organization, customer, service, and optionally a conversation, department, and assigned member, all in the same tenant. Includes `idempotency_key uuid not null`, generated immutable reference, request details, budget, priority, canonical status, structured details, confirmation and closure timestamps, and audit timestamps. `(organization_id, idempotency_key)` and global `reference_number` are unique.

### request_reference_counters

Belongs to an organization and has `(organization_id, reference_year)` as its primary key plus `last_value bigint not null`. It is private from application clients and changed only by the reference function.

### request_status_history

Append-only tenant history for each request transition, with previous/new status, actor type/member, reason, source, and timestamp.

### assignments

Append-only assignment history for a request, department/member, assigning member, reason, and active interval. A partial unique index permits only one active assignment row per request.

### attachments

Tenant metadata linked to at least one conversation or request, with uploader provenance, private storage bucket/path, original metadata, status, and timestamp. Both links may be present after request creation. No public URL or storage object is created in Phase 1.

### internal_notes

Tenant employee-only request notes with same-tenant author and timestamps. These are never available to `anon` and are not included in customer/model access policies.

### human_handoffs

Tenant handoff records linked to a conversation and optionally a request/assigned member, with reason, priority, status, and lifecycle timestamps.

### knowledge_documents

Tenant document metadata/content with approval provenance, activation, version, optional private storage path, and optional future external vector identifier. Only approved and active content will later be eligible for model context, but Phase 1 grants no public/model access.

### notifications

Tenant outbound-event records optionally linked to customer, member, and request, with channel, template, payload, delivery state, scheduling/result timestamps, and error text. Provider dispatch is out of scope.

### feedback

Tenant feedback linked to same-tenant request and customer, with rating 1–5, optional comment, and timestamp. One feedback record per `(organization_id, request_id, customer_id)` is assumed for MVP.

### audit_events

Append-only tenant audit records with actor type/member, action, entity type/id, request/conversation links when applicable, sanitized metadata, source, and timestamp. It must not store secrets or unnecessary message/file content.

Relationship summary:

```text
organizations
  ├── departments ── services
  ├── organization_members ── auth.users
  ├── customers
  │     ├── conversations ── messages
  │     ├── requests ── request_status_history
  │     │              ├── assignments
  │     │              ├── internal_notes
  │     │              ├── feedback
  │     │              └── notifications
  │     └── feedback
  ├── attachments ── conversations/requests
  ├── human_handoffs ── conversations/requests
  ├── knowledge_documents
  ├── request_reference_counters
  └── audit_events
```

## 8. Foreign keys and deletion behavior

Use named constraints and composite tenant foreign keys. Parent tables expose `unique (organization_id, id)` even when `id` is already globally unique.

- `organization_members.organization_id`, and every other tenant table's `organization_id`, references `organizations(id)` with `on delete restrict`.
- `organization_members.user_id -> auth.users(id)` uses `on delete restrict`; deactivation and a later deleted-user process are safer than cascading audited ownership.
- Optional department links use composite `(organization_id, department_id) -> departments(organization_id, id)` with `on delete restrict`.
- Service, customer, conversation, request, member, and author links use same-tenant composite foreign keys with `on delete restrict`.
- `messages` use `on delete restrict` for conversation/member to preserve history. Retention deletion will require an explicit later workflow.
- `request_status_history`, `assignments`, `internal_notes`, `feedback`, `notifications`, attachments, handoffs, and audit records use `on delete restrict` for operational parents.
- `request_reference_counters.organization_id` uses `on delete restrict`.
- `knowledge_documents.approved_by_member_id` and actor-member fields remain nullable but use `on delete restrict` when present.
- Reciprocal conversation/request foreign keys are added after both tables exist. Deferred constraint triggers verify at commit that non-null values point to one another.
- Do not cascade-delete an organization or request. Explicit archival/retention migrations are required before destructive production deletion.

## 9. Check constraints

Add named constraints for at least:

- Organization slug: normalized lowercase slug pattern; reference prefix: uppercase alphanumeric length bound; supported initial language values; non-empty name/timezone.
- Member roles: `admin`, `manager`, `commercial_officer`, `technical_officer`, `project_manager`, `support_officer`, `viewer`.
- Service `required_fields` is a JSON array.
- Customer phone, email, and preferred contact values have reasonable database-level length/non-empty checks; full validation remains in application schemas.
- Conversation channel is `web` in MVP; states match the documented five values; collected and confirmed fields are JSON objects.
- Message sender types match the documented values. Employee messages require `sender_member_id`; non-employee messages must not falsely claim an employee member. Content is non-empty and length-bounded. Metadata is a JSON object.
- Request type, priority, and status match canonical domain values. Title, description, location, and reference are non-empty. `budget_min` and `budget_max` are non-negative and min does not exceed max. Currency is three uppercase letters when present. `closed_at` is required only for terminal closure states chosen by workflow rules in a later service; Phase 1 should avoid over-constraining transitions it does not implement.
- Counter year is within a defensible range and `last_value > 0`.
- Status-history actor types and sources are allowed values; changed member is required for employee actor type.
- Assignment has at least a department or member, and `ended_at >= started_at` when ended.
- Attachment has at least a request or conversation, positive size, randomized non-empty path, allowed metadata statuses, and no URL field.
- Internal-note content is non-empty and length-bounded.
- Handoff priority/status match domain values; accepted/resolved timestamps are ordered and consistent with lifecycle state where safely enforceable.
- Knowledge version is positive; approval status is constrained; approved fields are required together; active documents must be approved; at least content text or storage path exists.
- Notification channel/status are constrained; payload is a JSON object; delivery timestamps are ordered.
- Feedback rating is between 1 and 5; comment length is bounded.
- Audit actor/source/entity/action fields are non-empty; metadata is a JSON object.
- Generic tenant-immutability triggers reject any `organization_id` update.
- Reference and request `idempotency_key` are immutable after insert.

Database checks enforce structural integrity, not the full status-transition graph. Phase 3 application services and tests will enforce workflow transitions.

## 10. Index strategy

Create only indexes justified by documented access patterns and FK maintenance:

- Unique normalized organization slug and reference prefix.
- Unique member `(organization_id, user_id)` and indexes for active membership by user and organization/department.
- Unique department name and service code per tenant; active catalog indexes.
- Customer lookup indexes on `(organization_id, phone_e164)` and normalized email when present; no phone uniqueness.
- Conversation indexes on tenant/state/update time, customer, assigned member, and optional external identity.
- Message `(conversation_id, created_at, id)`, tenant/provider partial unique, and conversation/client-message partial unique.
- Request indexes exactly matching documented dashboard/customer access patterns: tenant/status/created, department/status, assigned member/status, customer/created, service, conversation, and global unique reference.
- Unique request `(organization_id, idempotency_key)`.
- Status history `(request_id, created_at, id)` and assignment history `(request_id, started_at, id)`.
- Partial unique active assignment per request where `ended_at is null`.
- Attachment indexes by request, conversation, tenant/status, and unique `(storage_bucket, storage_path)`.
- Notes, handoffs, notifications, feedback, knowledge, and audit indexes on their parent IDs and tenant-specific queue/history order.
- Knowledge partial index for `(organization_id, updated_at)` where approved and active.
- Notification queue partial index on `(organization_id, scheduled_at, created_at)` for pending states.
- Reference counter primary key `(organization_id, reference_year)`.

Avoid speculative full-text, vector, or trigram indexes. Use `explain` in the phase that introduces search queries before adding specialized indexes.

## 11. Request reference-generation strategy

Use a private, transaction-safe counter function—not `SELECT MAX(...) + 1` and not one global sequence per tenant created dynamically.

1. `private.next_request_reference(organization_id, reference_timestamp)` validates the active organization and reads its immutable prefix.
2. In one statement, insert `(organization_id, year, 1)` into `request_reference_counters`; on conflict, atomically update `last_value = request_reference_counters.last_value + 1`; return the resulting value.
3. Format `<PREFIX>-<UTC year>-<six-or-more-digit sequence>` and return it.
4. A `before insert` request trigger assigns the reference when absent and rejects caller-supplied references from ordinary roles. A private service function may be used instead if trigger privilege semantics prove clearer during implementation.
5. A separate trigger rejects reference changes after insert.
6. Keep a global unique constraint on `requests.reference_number` and unique organization prefixes as final collision defenses.
7. Restrict direct execution of the function to the table owner/service role; `anon` and `authenticated` do not receive execute permission.

Concurrency tests open multiple sessions/transactions for the same organization/year and assert unique monotonic allocations without duplicate references. A transaction rollback may consume or roll back a counter depending on the upsert transaction; gaps are acceptable, reuse is not required, and references are never authentication factors.

## 12. Migration order

Use timestamp-prefixed, narrowly focused migrations created by the CLI. Proposed order:

1. `..._create_private_schema_and_shared_functions.sql`
   - Private schema, timestamp trigger, tenant-immutability helper, safe function ownership/search paths.
   - No production extension unless implementation proves one necessary and records why.
2. `..._create_organizations_departments_services.sql`
   - Organization/configuration tables, base constraints, composite keys, indexes.
3. `..._create_organization_members.sql`
   - Auth user and department links, role constraints, membership indexes.
4. `..._create_customers_conversations_messages.sql`
   - Customer/conversation/message tables without the conversation-to-request FK initially.
5. `..._create_requests_and_reference_generation.sql`
   - Counter, requests, reference function/trigger, then deferred reciprocal conversation/request FK and consistency triggers.
6. `..._create_request_history_and_assignments.sql`
   - Status history and assignments.
7. `..._create_support_and_content_tables.sql`
   - Attachments, notes, handoffs, knowledge, notifications, feedback, audit events.
8. `..._add_authorization_helpers.sql`
   - Private membership/role/department helper functions using fixed `search_path`, carefully owned and granted.
9. `..._enable_rls_and_policies.sql`
   - Grants, RLS enablement, and all deny-by-default policies.

Each migration must succeed from an empty database in order. Do not edit an already-applied migration after review; create a forward correction migration.

## 13. Row Level Security strategy

- Enable RLS on every `public` application table, including reference counters and audit events.
- Revoke all table privileges from `anon`; define no anonymous table policies in Phase 1.
- Grant `authenticated` only the SQL operations for which a policy exists. RLS and grants must both permit access.
- Put authorization helpers in `private`, set `security definer` only where necessary to avoid membership-policy recursion, use a fixed empty/minimal `search_path`, schema-qualify every object, and revoke execute from `public`/`anon`.
- `private.is_active_member(org_id)` checks `auth.uid()` against active membership.
- Additional helpers return current member ID, role, and department without accepting a user ID from the caller.
- Policy `using` expressions protect reads/deletes; `with check` expressions protect inserts/updates and require unchanged same-tenant ownership.
- Do not create public customer policies. Public chat will later call controlled Next.js server endpoints; those services resolve the tenant from trusted configuration and explicitly scope service-role queries.
- Service-role bypass is acknowledged but never treated as authorization. Future server repositories must still require and filter `organization_id`.
- Append-only tables have authenticated select/insert policies where justified, but no ordinary update/delete grants or policies.
- Test policy behavior through the actual `anon` and `authenticated` database roles with JWT claims, not only by querying as the database owner.

## 14. Role and permission strategy

Conservative Phase 1 baseline:

| Area | admin | manager | officers | viewer |
|---|---|---|---|---|
| Organization/config read | Own tenant | Own tenant | Own tenant active config | Own tenant active config |
| Organization/config write | Own tenant | No | No | No |
| Membership read | Own tenant | Own tenant | Active tenant directory | Self/active directory only |
| Membership write | Own tenant | No | No | No |
| Operational rows read | All own tenant | All own tenant | Same department or directly assigned; support/commercial may receive explicitly documented queue access | No operational access by default |
| Operational rows write | Structurally allowed, still subject to future services | Limited insert/update only where policy is defined | Append/update only for same department or direct assignment | None |
| Internal notes | Own tenant | Own tenant | Same department/direct assignment | None |
| Knowledge management | Own tenant | Read | Read approved active content | Read approved active content |
| Audit/history mutation | Insert through controlled operations; no update/delete | No update/delete | No update/delete | None |

“Officers” includes commercial, technical, project, and support roles. Because Phase 1 implements no business services, policies should avoid granting direct status, quotation, assignment, or handoff mutations merely because a role may eventually need them. Phase 2/3 will add or refine narrow policies alongside server authorization and tests.

Use database role checks as defense in depth. Server-side application services remain the primary place for workflow authorization.

## 15. Tenant-isolation strategy

- Every application table except `organizations` includes non-null `organization_id`.
- Every relationship between tenant tables includes `organization_id` in a composite foreign key.
- Every repository/query introduced later must require organization scope even when using service role.
- Tenant IDs for employees come from active membership, never request JSON.
- Tenant IDs for future public traffic come from trusted slug/configuration resolution at a controlled server endpoint.
- RLS policies derive user identity only from `auth.uid()` and database membership.
- Organization IDs are immutable after insert.
- Attachment paths later begin with a server-resolved organization segment; Phase 1 stores and validates metadata only.
- Knowledge, notes, messages, audit data, and histories receive the same isolation as primary requests.
- Tests use at least organizations A and B, multiple departments, active/deactivated members, and differently privileged roles.

## 16. Seed strategy

Use `supabase/seed.sql` for deterministic local BuildPro configuration only. Supabase migrations create structure; the CLI seed runs only during explicit local reset/seed workflows and is never part of production migration deployment.

Seed with stable UUIDs and idempotent inserts/upserts:

- BuildPro Cameroon: slug `buildpro-cameroon`, prefix `BP`, timezone `Africa/Douala`, default language `en`.
- Commercial Department, Technical Department, Customer Support.
- Building construction, house renovation, electrical installation, plumbing, painting, and site inspection, with deterministic codes and appropriate default departments.
- Representative service `required_fields` configuration grounded in the domain document.
- Approved FAQ/knowledge entries that contain fictional, approved company facts only.

Do not seed real personal information. Do not put credentials, service-role values, or production identifiers in SQL.

The documented administrator is created only in the development fixture because it requires a local `auth.users` identity; production membership provisioning belongs to a controlled onboarding/authentication workflow.

## 17. Development sample-data strategy

- Store representative sample users, memberships, customers, conversations, messages, requests, histories, assignments, attachments metadata, notes, handoffs, notifications, feedback, and second-tenant fixtures under `supabase/seeds/development.sql`.
- Do not list this file in production migration paths.
- Prefer not to list it in default seed paths; expose an explicit `db:seed:dev` script guarded to the local Supabase database URL/project ID.
- The guard must fail closed unless local Supabase status confirms the expected localhost host/port and project ID.
- Use obvious fictional contacts and deterministic UUIDs. Never use copied production data.
- Include organization B specifically for cross-tenant negative tests.
- Create local Auth test users through a supported local-only fixture mechanism. If stable direct `auth.users` fixture SQL is incompatible with the pinned Supabase version, use a test setup script through the local Auth admin API; do not alter production Auth internals in a migration.
- Database tests must be independently repeatable after `supabase db reset`; sample fixture application must be idempotent or always start from reset state.

## 18. TypeScript database-type strategy

- Generate types from the reset local database with the pinned CLI into `lib/supabase/database.types.ts`.
- Check the generated file into Git so application code and CI do not require a live database merely to typecheck/build.
- Add `npm run db:types` for generation and `npm run db:types:check` that generates to a temporary path and compares it with the checked-in file without overwriting it.
- Do not hand-edit generated types. Add small manually maintained aliases in a separate `lib/supabase/types.ts` only when they improve readability and remain derived from `Database` types.
- CI database job resets migrations, regenerates types, and fails on drift.
- Do not create browser/server clients merely to demonstrate generated types. If `@supabase/supabase-js` is added, include a compile-only typed client/test that does not expose the service-role key.

## 19. Test strategy

### Migration tests

- Fresh `supabase db reset` applies every migration in order and loads only configured BuildPro seed data.
- `supabase db lint` reports no unsafe or invalid database objects.
- Expected tables, columns, constraints, indexes, triggers, functions, RLS flags, grants, and policies exist.
- Every tenant-owned table has non-null `organization_id`, composite tenant key, and tenant-immutability enforcement.
- All cross-table tenant relationships use composite foreign keys.
- Invalid role/status/channel/sender/rating/budget/timestamp/JSON-shape inputs fail with named constraints.
- Cross-tenant foreign key inserts fail even when executed by an owner/service role.
- Request references are unique, immutable, correctly formatted, and safe under concurrent allocation.
- Duplicate request idempotency keys in one tenant fail; the same key in a different tenant is allowed.
- Reciprocal conversation/request links are consistent at transaction commit.
- Append-only histories/audit rows cannot be updated/deleted by ordinary authenticated roles.
- Seed reset is deterministic and does not duplicate records.

### RLS tests

- Tests set `anon` or `authenticated` roles and JWT claims explicitly.
- Active members see only permitted rows in their organization.
- Deactivated and non-member users see no tenant data.
- Admin and manager behavior matches the conservative matrix.
- Department-limited officers cannot cross departments unless directly assigned under an explicit policy.
- Viewers cannot read operational/customer/private data.
- `anon` cannot select, insert, update, or delete application table rows.
- Forging `organization_id` in inserted/updated data fails.
- Internal notes, audit metadata, reference counters, and unapproved knowledge remain private.
- Service-role test setup demonstrates bypass, followed by explicit tests of repository-level tenant scoping when repositories are introduced in later phases.

### Type and repository checks

- Generated types match migrations.
- Existing lint, formatting, strict typecheck, unit tests, and Next.js build continue to pass without a running database unless a database-specific script is invoked.
- Database integration scripts fail clearly when local Supabase is unavailable or the wrong environment is targeted.

## 20. Cross-tenant negative-test scenarios

At minimum, with tenants A and B:

1. A member of A cannot select B's organization details beyond intentionally public-safe data (none is direct in Phase 1).
2. A member of A cannot list, read, insert, update, or delete B's members, departments, services, customers, conversations, messages, requests, histories, assignments, attachments, notes, handoffs, knowledge, notifications, feedback, counters, or audit events.
3. A deactivated member of A cannot read or write A data.
4. An unaffiliated authenticated user cannot read either tenant.
5. `anon` cannot enumerate organizations, services, requests, references, conversations, or any other application table.
6. An insert with `organization_id = A` and `customer_id`, `service_id`, `department_id`, `member_id`, `conversation_id`, or `request_id` from B fails at the composite foreign key even for privileged test setup.
7. An update cannot move a row from A to B.
8. An A user cannot assign a B department/member or author a note/history record as a B member.
9. An A user cannot link an attachment, handoff, feedback, notification, or audit event to a B parent.
10. A user cannot infer B records through uniqueness errors, reference lookup, counter access, or policy helper return values.
11. Identical idempotency keys may exist independently in A and B, while duplicate keys in A fail.
12. Provider/client message identifiers are tenant/conversation scoped and cannot be used to retrieve another tenant's message.

## 21. Migration and rollback safety

- Treat migrations as immutable after application to shared environments. Fix mistakes with new forward migrations.
- Run every migration from an empty local database and from the immediately previous migration state.
- Wrap data-preserving schema changes in transactions where PostgreSQL permits.
- Use explicit `lock_timeout`/`statement_timeout` guidance for future production alterations; Phase 1 creates empty/new tables so backfill locks are minimal.
- Avoid destructive `drop`, type rewrites, and `not null` additions with unbackfilled production data. Phase 1 has no production data.
- Make seed operations idempotent and separate from migrations.
- Supabase's normal forward-migration model is authoritative; do not create fake down migrations that risk data loss.
- For local rollback, reset the disposable local database to migrations. For a shared environment, create a reviewed compensating migration and restore from backup if data loss occurred.
- Before any future production deployment, take/verify backups and test restoration per security requirements.
- Test reference and policy functions with fixed `search_path`, correct ownership, least-privilege grants, and no SQL injection through identifiers.
- Record migration checksums/order in Git and fail CI on generated-type drift.
- Do not run development sample SQL against a remote database. Guarded scripts must inspect the target and require an unmistakably local endpoint.

## 22. Expected files to create or modify

Expected new files:

- `supabase/config.toml` — pinned local project ports/settings and configured core seed path.
- `supabase/migrations/<timestamp>_create_private_schema_and_shared_functions.sql`
- `supabase/migrations/<timestamp>_create_organizations_departments_services.sql`
- `supabase/migrations/<timestamp>_create_organization_members.sql`
- `supabase/migrations/<timestamp>_create_customers_conversations_messages.sql`
- `supabase/migrations/<timestamp>_create_requests_and_reference_generation.sql`
- `supabase/migrations/<timestamp>_create_request_history_and_assignments.sql`
- `supabase/migrations/<timestamp>_create_support_and_content_tables.sql`
- `supabase/migrations/<timestamp>_add_authorization_helpers.sql`
- `supabase/migrations/<timestamp>_enable_rls_and_policies.sql`
- `supabase/seed.sql` — deterministic BuildPro configuration only.
- `supabase/seeds/development.sql` — explicitly invoked local sample data.
- `supabase/tests/001_schema.test.sql`
- `supabase/tests/002_constraints.test.sql`
- `supabase/tests/003_reference_generation.test.sql`
- `supabase/tests/004_rls_tenant_isolation.test.sql`
- `supabase/tests/005_rls_roles.test.sql`
- `lib/supabase/database.types.ts` — generated, checked-in types.
- `lib/supabase/types.ts` — optional derived aliases only if needed.
- `tests/integration/database-types.test.ts` or a dedicated database test harness if SQL tests alone cannot cover type/client behavior.
- `scripts/verify-local-supabase.mjs` — optional fail-closed target guard for development sample loading.

Expected modifications:

- `package.json` and `package-lock.json` — pinned CLI, justified client/test dependency if needed, and database scripts.
- `.env.example` and `lib/config/env-schema.ts` — document/validate local Supabase values when the phase actually consumes them; service-role remains server-only.
- `.gitignore` — local Supabase generated/cache files and ignored test environment files, while migrations/config/seeds/types/tests remain tracked.
- `.github/workflows/ci.yml` — separate database job with local Supabase start/reset/lint/tests/type-drift check; preserve the existing application quality job.
- `README.md` and `PROJECT_TREE.txt` — local prerequisites, commands, seed boundaries, and actual Phase 1 structure.
- `docs/11_DECISIONS.md` — record durable choices for composite tenant foreign keys, reference counters, conservative RLS, and seed separation if implementation confirms them.
- `docs/plans/phase-1-supabase-foundation.md` — progress, deviations, verification evidence, and completion notes.

Do not create repositories, services, API routes, UI, storage buckets, auth pages, or OpenAI modules in this phase.

## 23. Commands to run during implementation

Exact flags may be adjusted to the pinned CLI after checking `supabase --help`; record actual commands and never claim unrun results.

```bash
node --version
npm --version
docker version
npm install --save-dev --save-exact supabase
npm install --save-exact @supabase/supabase-js
npx supabase init
npx supabase start
npx supabase status
npx supabase migration new <descriptive_name>
npx supabase db reset
npx supabase db lint
npx supabase test db
npx supabase gen types typescript --local
npm run db:types:check
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npx supabase stop
```

Planned package scripts should provide stable wrappers such as `db:start`, `db:stop`, `db:reset`, `db:lint`, `db:test`, `db:seed:dev`, `db:types`, and `db:types:check`. CI must start/stop local services reliably and preserve useful failure logs without printing keys.

## 24. Acceptance criteria

- A fresh clone with Node 24, npm 11.12.1, Docker, and the pinned CLI can start local Supabase and reset the database from version-controlled migrations.
- All tables in this plan exist with UUID keys, timestamps, named checks, justified indexes, and explicit deletion behavior.
- Every tenant-owned table includes non-null `organization_id`, a composite tenant key, composite tenant foreign keys, RLS, and tenant immutability.
- No request reference uses `SELECT MAX(...) + 1`; concurrent generation produces unique immutable references in the documented format.
- Request creation has a tenant-scoped unique idempotency key foundation.
- `anon` has no broad direct table access.
- Active authenticated access follows the conservative role/department matrix; deactivated/non-member access fails.
- Cross-tenant reads, writes, updates, assignments, and relationship forgery fail in automated negative tests.
- BuildPro organization, three departments, six services, and approved fictional knowledge load deterministically in local seed workflows.
- Development users/customers/requests are isolated in an explicitly local-only fixture and cannot be applied accidentally through production migrations.
- Database types regenerate deterministically and match the checked-in TypeScript file.
- Migration, constraint, reference concurrency, RLS, role, and seed tests pass.
- Existing `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- CI runs both application quality gates and database migration/security tests without committed secrets.
- No Supabase service-role key appears in browser code, emitted client assets, tracked environment files, or logs.
- No Phase 2+ application or product feature is introduced.

## 25. Security review

- RLS and grants are deny-by-default; no `anon` table policy is added.
- All tenant relationships are database-enforced through composite foreign keys.
- Membership helpers cannot be caller-spoofed, recurse through RLS, inherit unsafe search paths, or expose other tenants.
- Deactivation takes effect immediately because every authenticated policy checks active membership.
- Service-role credentials remain server-only and are used only in local setup/tests during this phase.
- Future service-role repositories must explicitly filter organization despite RLS bypass.
- Reference numbers are unique identifiers, not authentication factors; counters and generation functions are not public.
- Internal notes, histories, audit events, unapproved knowledge, attachment paths, notification errors, and customer data are never public.
- Seed and fixture data is fictional; sample fixture application fails closed for non-local targets.
- SQL functions use schema-qualified names, fixed search paths, least-privilege ownership/grants, and safe argument types.
- RLS tests cover both data returned and forbidden writes without leaking record existence through helper functions.
- No storage bucket is created; attachment metadata cannot grant file access.
- Logs and CI output must redact URLs containing credentials and never print JWTs/service-role values.
- Migration review checks grants as well as policies because RLS alone does not revoke SQL privileges.

## 26. Progress checklist

- [x] Verify and read every required document, including the index-required API contracts.
- [x] Inspect Phase 0 structure, scripts, environment validation, tests, and Supabase-related files.
- [x] Identify and resolve non-blocking documentation ambiguities in this plan.
- [x] Create the Phase 1 execution plan.
- [x] Confirm implementation-time local prerequisites and pinned Supabase CLI compatibility.
- [x] Add local Supabase configuration and database scripts.
- [x] Create and apply ordered migrations.
- [x] Add constraints, indexes, reference generation, and reciprocal-link enforcement.
- [x] Add authorization helpers, grants, and RLS policies.
- [x] Add deterministic BuildPro configuration seed.
- [x] Add guarded development-only fixtures.
- [x] Generate and verify TypeScript database types.
- [x] Add migration, constraint, reference, RLS, role, and cross-tenant tests.
- [x] Add database CI job and documentation.
- [x] Run final clean reset, all database checks, application quality gates, and security scans.
- [x] Review the final diff for unrelated changes and Phase 2+ behavior.
- [x] Record final command results, deviations, decisions, and remaining limitations.

## 27. Decision log

- 2026-08-06: Plan only; no Supabase configuration, migration, policy, package, type, or application code was created.
- 2026-08-06: Use no production PostgreSQL extension in Phase 1 unless implementation proves it necessary. Core UUID generation is sufficient; vector/trigram/search extensions are premature.
- 2026-08-06: Use composite tenant foreign keys throughout so a privileged bug cannot create cross-tenant relationships.
- 2026-08-06: Add `requests.idempotency_key uuid not null` because the documented uniqueness rule and confirmation contract require it even though the schema field list omitted it.
- 2026-08-06: Do not enforce customer phone uniqueness because the schema explicitly requires support for shared numbers; use a tenant lookup index.
- 2026-08-06: Retain both documented conversation/request links and enforce reciprocity with deferred constraint triggers.
- 2026-08-06: Use an upserted per-organization/year counter row for references. Never use `SELECT MAX(...) + 1`.
- 2026-08-06: Use text plus named checks rather than PostgreSQL enums for evolving roles/statuses.
- 2026-08-06: Add a generic append-only `audit_events` table because security requirements cover important events beyond request status changes.
- 2026-08-06: Apply a conservative RLS role matrix in Phase 1; later plans may expand access only with explicit requirements and negative tests.
- 2026-08-06: Keep BuildPro configuration in local seed SQL and representative operational/auth data in a separately guarded development fixture; neither is a production migration.
- 2026-08-06: Generate and commit database types, and fail CI on drift rather than hand-maintaining the database schema type.
- 2026-08-06: Implementation pinned Supabase CLI 2.111.0 and local PostgreSQL 17 through committed configuration. No production extension was required; pgTAP remains test-only.
- 2026-08-06: Authenticated policy helpers receive only the narrow `EXECUTE` grants needed by RLS. Reference allocation and trigger functions remain inaccessible to client roles.
- 2026-08-06: The development fixture is excluded from automatic seed paths and requires both an explicit environment opt-in and a loopback database reported by the local CLI.

## 28. Known risks and limitations

- Supabase CLI/PostgreSQL versions may require small syntax/config adjustments during implementation. Pin versions and record any deviation before changing migration design.
- The complete business permission matrix is not yet specified. Phase 1 intentionally denies ambiguous access; Phase 2/3 must refine it with product decisions and tests.
- Reciprocal conversation/request columns add consistency complexity. Deferred checks and transaction tests are mandatory; a later ADR may simplify to one canonical link if product queries permit.
- Direct local Auth fixture creation can be sensitive to Supabase Auth schema versions. Prefer supported local APIs/test helpers and never migrate Auth internals.
- Reference counters can become a per-tenant/year contention point at very high volume. This is acceptable for pilot scale and can be measured before redesign.
- RLS helper mistakes can create recursion or privilege escalation. Fixed search paths, least privilege, SQL review, and role-level tests are mandatory.
- Text check constraints require forward migrations when new statuses/roles/channels are added. This is intentional and safer than accepting arbitrary values.
- The generic audit event payload must remain sanitized and bounded; it is not a substitute for storing full before/after records or sensitive content.
- Database tests require Docker/local Supabase and will be slower than Phase 0 unit tests. Keep them in a distinct CI job while preserving fast application checks.
- No production tenant onboarding, storage object security, status verification, retention deletion, backup restore, or application repository behavior is delivered in Phase 1.

## Implementation progress log

- 2026-08-06: Inspected the Phase 0 baseline, installed the exact Supabase CLI development dependency, and initialized local configuration.
- 2026-08-06: Added three ordered migrations covering the schema, integrity/reference functions, and deny-by-default RLS policies.
- 2026-08-06: Added deterministic BuildPro reference data and a separately guarded development-only operational fixture.
- 2026-08-06: Added 29 pgTAP assertions covering schema/seed integrity, reference allocation, constraints, grants, roles, and cross-tenant denial.
- 2026-08-06: First RLS test run failed closed because policy helper execution was also revoked; narrowed grants to only the six RLS helpers, reset, and confirmed the complete suite passes.
- 2026-08-06: Generated TypeScript types from the applied local schema and added database validation to CI.
- 2026-08-06: The initial Docker image download was rate-limited and slow, but the pinned PostgreSQL and pgTAP runner images eventually completed. This did not require a schema or security workaround.
- 2026-08-06: An opted-in development fixture run exposed unsafe field access in the shared deferred reciprocal-link trigger. The trigger now branches by source table before referencing table-specific fields, and the constraint test forces deferred evaluation.
- 2026-08-06: Final verification passed: clean database reset; seed counts `1 organization / 3 departments / 6 services / 4 approved knowledge documents / 0 customers / 0 requests`; database lint; 30 pgTAP assertions; deterministic type regeneration; formatting; lint; strict typecheck; 8 unit tests; and production build.
- 2026-08-06: Phase 1 implementation is complete locally. Hosted project linking and migration deployment remain manual release steps; Phase 2 has not started.
- 2026-08-07: Linked the repository to the approved hosted `smartdesk-ai` project after confirming PostgreSQL 17 compatibility and an empty application schema. The link metadata remains in Supabase's ignored local `.temp` directory; no credential was committed.
- 2026-08-07: Previewed and deployed exactly the three Phase 1 migrations plus `supabase/seed.sql`. The development-only fixture was absent from the deployment set.
- 2026-08-07: Hosted verification confirmed 18 application tables, 40 RLS policies, RLS enabled and forced on every table, no anonymous table grants or policies, and no client access to the private schema.
- 2026-08-07: Hosted reference-data verification confirmed `1 organization / 3 departments / 6 services / 4 approved knowledge documents / 0 customers / 0 requests`. Remote schema lint and seven transaction-rolled-back RLS denial assertions passed. A final dry run reported no pending migrations or seeds.
- 2026-08-07: Phase 1 is deployed and verified on the approved hosted project. No Phase 2 work was performed.
- 2026-08-07: A follow-up security audit found the Phase 1 working tree was not yet committed and identified reference-prefix reuse, client-forgeable audit inserts, unrestricted attachment paths, broad cascade deletion, notification mutation, and test-coverage gaps.
- 2026-08-07: Added a forward-only hardening migration; the three already-deployed migrations remain immutable. The migration adds global reference uniqueness and used-prefix immutability, retention-safe foreign keys, server-only attachment/audit/history writes, tenant-bound attachment metadata, read-only notification mutation, submission/status/size constraints, and missing indexes.
- 2026-08-07: Expanded verification to 45 pgTAP assertions and a real 20-process concurrency test. Clean reset, database lint, deterministic type generation, lint, formatting, strict typecheck, 8 unit tests, and production build passed before hosted deployment review.
- 2026-08-07: Deployed the single reviewed hardening migration and deterministic seed update to the hosted project. Four migration versions now match locally and remotely.
- 2026-08-07: Hosted verification passed 14 transaction-rolled-back security assertions covering public denial, forced RLS, protected inserts, global references, prefix protection, notification column grants, restrictive deletion, attachment tenant paths, history constraints, and non-member denial. Remote lint passed and the final dry run reported no pending changes.
- 2026-08-07: Hosted data remained production-safe after hardening: `1 organization / 3 departments / 6 services / 4 approved knowledge documents / 0 customers / 0 requests`, with all other operational tables empty.
- 2026-08-07: Committed the complete Phase 1 baseline and reproduced it in a disposable clean checkout with Node 24/npm 11. Clean install, four migrations, seed, database lint, 45 pgTAP assertions, 20 concurrent allocations, generated-type drift check, lint, typecheck, 8 unit tests, and production build passed. The reproduction exposed generated Supabase `.temp` JSON to formatting; that ignored cache is now excluded and the formatting check was repeated.
- 2026-08-07: The first Phase 1 database CI run spent its startup step downloading optional Supabase services. CI now starts only PostgreSQL, which is sufficient for migrations, pgTAP, concurrency, lint, and type generation and reduces runtime and unnecessary image exposure.

Phase 1 is implemented and its database is hardened and verified locally and remotely. Repository readiness is established when this complete baseline is committed, pushed, and reproduced from a clean checkout.

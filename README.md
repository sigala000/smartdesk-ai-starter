# SmartDesk AI

SmartDesk AI is a multi-tenant customer request, quotation follow-up, and human-handoff platform for service companies. BuildPro Cameroon is the fictional validation tenant.

The repository implements Phases 0–10: secure employee and company-owner onboarding, tenant-scoped request management, deterministic and OpenAI-assisted web chat, private attachments, human handoff, verified status lookup, Meta developer-test WhatsApp, and the application-side production WhatsApp SaaS foundation. A company can configure its catalogue/team and connect client-owned Meta assets through Embedded Signup. Real production WhatsApp still requires the documented Meta App Review, business/number verification, legal, billing, and owner-approval gates.

## Prerequisites

- Node.js 24
- npm 11
- Docker Desktop or another Docker-compatible runtime (for database work)

The supported Node major is recorded in `.nvmrc` and `package.json`. With nvm installed:

```bash
nvm use
```

## Setup

Install the locked dependencies:

```bash
npm ci
```

Create a local environment file from the safe example:

```bash
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the Supabase environment used by the application. These values are browser-safe; never place the service-role key in a `NEXT_PUBLIC_*` variable. Never commit `.env.local` or place real credentials in `.env.example`.

The public chat additionally requires `SUPABASE_SERVICE_ROLE_KEY` and a strong random `PUBLIC_RATE_LIMIT_SECRET` on the server. Neither value is browser-safe. With local Supabase configured, open `http://localhost:3000/chat/buildpro-cameroon`.

Start the development server:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Quality commands

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Use `npm run format` to apply the repository's formatting rules. CI installs the repository's declared npm version, performs a clean install, and then runs all five checks.

## Local database

Start Supabase, rebuild from migrations and the production-safe BuildPro reference seed, then run database checks:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types
npm run db:stop
```

`supabase/seed.sql` contains only fictional BuildPro configuration and approved knowledge. Operational sample customers and requests are isolated in `supabase/seeds/development.sql`; it is not configured for automatic seeding. To load it against the running local stack, explicitly opt in:

```bash
ALLOW_LOCAL_SAMPLE_DATA=true npm run db:seed:development
```

The guard refuses to run unless the local Supabase database is active on a loopback address. Never apply this development fixture to a hosted project. Database types are generated from the local schema into `lib/supabase/database.types.ts`; CI fails if regeneration creates a diff.

`npm run db:test` also provisions temporary confirmed local Auth users, verifies password login and RLS tenant scope, tests protected employee routes, and exercises request and public-conversation APIs over HTTP. Phase 4 checks cover opaque conversation access, deterministic guided collection, duplicate messages, server summary/nonce confirmation, idempotent request creation, backend references, and employee-dashboard visibility. Test fixtures are deleted after each run. The temporary service-role key is read from the local CLI and remains server-side.

## Company and employee onboarding

New company owners use `/register`, confirm their email according to the configured Supabase Auth policy, then create an isolated workspace at `/onboarding`. Admins configure departments/services and invite employees from the organization dashboard. Existing administrator provisioning remains available for controlled pilots:

```sql
insert into public.organization_members (
  organization_id,
  user_id,
  display_name,
  role,
  department_id
)
select
  '10000000-0000-4000-8000-000000000001',
  id,
  'BuildPro Administrator',
  'admin',
  '11000000-0000-4000-8000-000000000001'
from auth.users
where email = 'replace-with-employee-email@example.com';
```

Run this only after replacing the example email and confirming that the selected user is the intended employee. The valid role values are `admin`, `manager`, `commercial_officer`, `technical_officer`, `project_manager`, `support_officer`, and `viewer`.

For local development, get the local API URL and anon key from `npx supabase status -o env`, map them to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`, and create the employee in local Supabase Studio. For hosted setup, configure the hosted application URL/redirect allowlist, disable public signup, keep the email provider enabled, require verified administrator-provisioned accounts, and match the password policy before provisioning the employee.

The application deliberately denies users with no active membership, a deactivated membership, an inactive organization, or more than one active membership. Organization selection is not implemented in Phase 2.

## Environment boundary

Environment variables are parsed through schemas in `lib/config/`.

- `env-public.ts` exposes only explicitly allowlisted `NEXT_PUBLIC_*` values.
- `env-server.ts` is server-only and includes private integration values.
- Empty values remain valid for commands that do not instantiate Supabase Auth; authentication routes fail safely until the two public Supabase values are configured.
- Validation errors identify invalid variable names without echoing their values.

The core and Phase 10 variables are documented in `.env.example`. Important additions include:

| Variable                              | Exposure     | Required in Phase 2            |
| ------------------------------------- | ------------ | ------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`            | Browser-safe | Yes, for authentication routes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | Browser-safe | Yes, for authentication routes |
| `SUPABASE_SERVICE_ROLE_KEY`           | Server only  | Yes, for public chat routes    |
| `PUBLIC_RATE_LIMIT_SECRET`            | Server only  | Yes, for public chat routes    |
| `OPENAI_API_KEY`                      | Server only  | When OpenAI is enabled         |
| `META_APP_SECRET`                     | Server only  | When WhatsApp is enabled       |
| `META_CREDENTIAL_ENCRYPTION_KEY`      | Server only  | Production tenant connections  |
| `NEXT_PUBLIC_META_APP_ID`             | Browser-safe | Embedded Signup                |
| `NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID` | Browser-safe | Embedded Signup                |
| `APP_BASE_URL`                        | Server only  | Hosted onboarding              |

`OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to browser code.

## Current architecture

The implemented foundation contains:

```text
app/                 Public entry, employee login, and protected dashboard routes
components/          Authentication and dashboard shell components
lib/auth/            Membership resolution, roles, permissions, and guards
lib/config/          Environment parsing and server/browser boundaries
lib/core/            Framework-independent result and error primitives
lib/domain/          Request values, workflow transitions, and cursor rules
lib/repositories/    Organization-scoped Supabase request data access
lib/services/        Request application services and typed business outcomes
lib/supabase/        Cookie-aware browser/server clients and generated types
tests/unit/          Foundation and authorization unit tests
.github/workflows/   Continuous-integration quality checks
supabase/migrations/ Version-controlled schema, integrity rules, and RLS
supabase/tests/      pgTAP schema, tenant-isolation, and employee-access tests
supabase/seed.sql    Production-safe BuildPro reference data
```

Architectural folders are added only when a phase has executable code for them. Business rules do not belong in React components, and future privileged operations must remain on the server.

## Implementation order

The authoritative order is maintained in `docs/10_IMPLEMENTATION_ROADMAP.md`:

1. Repository foundation
2. Supabase foundation and tenant isolation
3. Employee authentication and shell
4. Request domain without AI
5. Public conversation and structured draft
6. OpenAI orchestration
7. Attachments
8. Human handoff and follow-up
9. Status verification
10. Hardening and pilot preparation
11. Multi-tenant SaaS and production WhatsApp foundation

Do not begin a later phase until its documentation and execution plan have been reviewed.

## Documentation

- `AGENTS.md` defines repository-wide working and security rules.
- `docs/00_INDEX.md` maps tasks to their required specifications.
- `docs/plans/phase-0-repository-foundation.md` records the Phase 0 design, progress, decisions, and verification evidence.
- `docs/plans/phase-1-supabase-foundation.md` records the Phase 1 database foundation.
- `docs/plans/phase-2-employee-authentication.md` records the Phase 2 authentication implementation.
- `docs/plans/phase-3-request-management.md` records the Phase 3 employee request-management implementation.
- `docs/plans/phase-4-public-chat-and-request-draft.md` records the deterministic Phase 4 customer workflow.
- `docs/plans/phase-10-multi-tenant-saas-and-production-whatsapp.md` records the current SaaS/Meta implementation, security decisions, verification, and external gates.

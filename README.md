# SmartDesk AI

SmartDesk AI is a planned multi-tenant customer request and follow-up platform for service companies. It will combine guided request capture, human escalation, and an employee workflow. The first validation tenant is BuildPro Cameroon, a fictional construction company.

The repository currently implements **Phase 2**: the executable Next.js and Supabase foundation plus secure employee email/password authentication, server-side active-membership and role resolution, protected dashboard routes, and a role-aware dashboard shell. Request-management pages, customer chat, storage workflows, and OpenAI are not implemented yet.

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

`npm run db:test` also provisions temporary confirmed local Auth users, verifies password login and RLS tenant scope, deactivates a membership while its Auth session remains valid, verifies access is removed, tests logout, and exercises protected Next.js routes over HTTP. The route checks cover unauthenticated, malformed-session, deactivated-member, and direct role-denial cases without rendering protected content. Test fixtures are deleted after each run. The temporary service-role key is read from the local CLI only and is never used by browser or application authentication code.

## Employee authentication setup

Employee self-registration is disabled. Create employees through the Supabase administrator interface, use a password of at least 12 characters, and ensure the email is confirmed. Then create exactly one active membership that references the Auth user:

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

The currently documented variables are:

| Variable                        | Exposure     | Required in Phase 2            |
| ------------------------------- | ------------ | ------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser-safe | Yes, for authentication routes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe | Yes, for authentication routes |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only  | No; not used by employee auth  |
| `OPENAI_API_KEY`                | Server only  | No                             |
| `OPENAI_MODEL`                  | Server only  | No                             |
| `APP_BASE_URL`                  | Server only  | No                             |

`OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to browser code.

## Current architecture

The implemented foundation contains:

```text
app/                 Public entry, employee login, and protected dashboard routes
components/          Authentication and dashboard shell components
lib/auth/            Membership resolution, roles, permissions, and guards
lib/config/          Environment parsing and server/browser boundaries
lib/core/            Framework-independent result and error primitives
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

Do not begin a later phase until its documentation and execution plan have been reviewed.

## Documentation

- `AGENTS.md` defines repository-wide working and security rules.
- `docs/00_INDEX.md` maps tasks to their required specifications.
- `docs/plans/phase-0-repository-foundation.md` records the Phase 0 design, progress, decisions, and verification evidence.
- `docs/plans/phase-1-supabase-foundation.md` records the Phase 1 database foundation.
- `docs/plans/phase-2-employee-authentication.md` records the Phase 2 authentication implementation.

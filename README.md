# SmartDesk AI

SmartDesk AI is a planned multi-tenant customer request and follow-up platform for service companies. It will combine guided request capture, human escalation, and an employee workflow. The first validation tenant is BuildPro Cameroon, a fictional construction company.

The repository currently implements **Phase 1**: the executable Next.js foundation plus a local, migration-driven Supabase schema and tenant-isolation policies. Employee authentication pages, customer chat, the employee dashboard, application request workflows, storage buckets, and OpenAI are not implemented yet.

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

Phase 0 does not require external-service credentials. Leave the placeholders empty. Never commit `.env.local` or place real credentials in `.env.example`.

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

## Environment boundary

Environment variables are parsed through schemas in `lib/config/`.

- `env-public.ts` exposes only explicitly allowlisted `NEXT_PUBLIC_*` values.
- `env-server.ts` is server-only and includes private integration values.
- Empty values are treated as unconfigured during Phase 0.
- Validation errors identify invalid variable names without echoing their values.

The currently documented variables are:

| Variable                        | Exposure     | Required in Phase 0 |
| ------------------------------- | ------------ | ------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser-safe | No                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe | No                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only  | No                  |
| `OPENAI_API_KEY`                | Server only  | No                  |
| `OPENAI_MODEL`                  | Server only  | No                  |
| `APP_BASE_URL`                  | Server only  | No                  |

Later phases will make variables required only when their integrations are implemented. `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to browser code.

## Current architecture

The implemented foundation contains:

```text
app/                 Minimal App Router shell
lib/config/          Environment parsing and server/browser boundaries
lib/core/            Framework-independent result and error primitives
tests/unit/          Foundation unit tests
.github/workflows/   Continuous-integration quality checks
supabase/migrations/ Version-controlled schema, integrity rules, and RLS
supabase/tests/      pgTAP schema and tenant-isolation tests
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

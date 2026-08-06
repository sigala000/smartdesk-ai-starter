# Plan: Phase 0 repository foundation

## Goal

Turn the documentation-only SmartDesk AI directory into a minimal, reproducible Next.js TypeScript repository that installs from a fresh clone, validates its environment, exposes shared typed result and error primitives, and passes lint, typecheck, test, and production-build checks locally and in CI.

Phase 0 establishes engineering foundations only. It does not implement customer, employee, Supabase, storage, or OpenAI behavior.

## User value

Developers receive a predictable and secure base for later product phases. Every subsequent change can be checked through the same commands, secrets have an explicit boundary from the start, and expected business failures can use one typed convention rather than incompatible ad hoc patterns.

## Current state

As inspected on 2026-08-06:

- The repository root contains `AGENTS.md`, `README.md`, `PROJECT_TREE.txt`, `.agent/`, and the product documentation under `docs/`.
- The restored `docs/01_PRODUCT_REQUIREMENTS.md` is present.
- There is no `package.json`, lockfile, application source, TypeScript configuration, test configuration, environment example, ignore file, or CI workflow.
- The directory is not currently recognized as a Git worktree; `.git` is absent and `git status` fails.
- The local tools report Node.js `v24.15.0` and npm `11.12.1`.
- No database, migrations, authentication, integrations, or application features exist.

The documentation is the source of truth. Material scope or architecture changes discovered during implementation must be recorded in `docs/11_DECISIONS.md`, while execution discoveries and deviations belong in this plan's decision and progress logs.

## Scope

- Initialize a minimal Next.js application using the App Router and strict TypeScript.
- Use npm and commit a lockfile for reproducible installs.
- Pin and document the supported Node.js major version.
- Add scripts named `dev`, `lint`, `typecheck`, `test`, and `build`.
- Configure ESLint and a lightweight unit-test runner.
- Add a neutral root page that identifies SmartDesk AI as an unimplemented foundation build; it must not simulate chat, authentication, requests, pricing, or any other product capability.
- Add server-only and browser-safe environment schemas with explicit public/private separation.
- Add a checked-in `.env.example` containing placeholders only.
- Add shared typed application-result and application-error primitives based on the architecture's error categories.
- Add focused unit tests for environment validation and shared result/error behavior.
- Add basic GitHub Actions CI that performs a clean install and all four required quality commands.
- Update root documentation with prerequisites, setup, environment handling, commands, repository boundaries, and the current phase status.
- Add ignore rules for dependencies, build output, local environment files, coverage, logs, editor/OS artifacts, and other generated files.

## Out of scope

- Supabase packages, configuration, migrations, seed data, generated database types, RLS, authentication, or storage.
- OpenAI SDK setup, prompts, agents, tool schemas, model calls, or model configuration beyond reserving documented environment-variable names.
- Chat, customer forms, employee dashboard, request workflows, references, assignment, status changes, audit history, attachments, handoff, notifications, or status verification.
- Tenant resolution or authorization logic.
- API endpoints or server actions for product behavior.
- End-to-end browser testing; this begins when a user journey exists.
- Deployment, staging infrastructure, production secrets, monitoring, rate limiting, retention, backups, or recovery operations.
- Git hosting or remote-repository creation. If the working directory is intended to become the repository root, local Git initialization may be performed during implementation, but configuring or pushing a remote requires separate authorization and repository details.
- Resolving later-phase product ambiguities such as quotation-upload ownership, routing configuration, or administrator UI scope.

## Dependencies and assumptions

- Node.js 24 is the proposed supported major because it matches the inspected environment. Record the exact policy in `package.json`, `.nvmrc`, and README; CI must use the same major. If the project owner requires another active LTS major, update all three together before installing dependencies.
- npm is the package manager because `AGENTS.md` defines npm-shaped quality commands. The `package-lock.json` is authoritative and CI uses `npm ci`.
- Use the current stable Next.js, React, and compatible TypeScript/tooling versions resolved when implementation begins. Record installed versions in the lockfile rather than hand-writing unverified version numbers in this plan.
- Use the Next.js App Router. Do not add a second routing model.
- Use ESLint for linting and Vitest for unit tests. Add no browser-test framework until a later phase has a browser journey to test.
- Use Zod for environment validation because external inputs require schemas and later phases can reuse it. This is the only planned runtime dependency beyond the framework stack; its purpose must be documented.
- Phase 0 must not require Supabase or OpenAI credentials to install, test, or build because those integrations do not yet exist. Their names may appear as optional, server-only placeholders in `.env.example`; they become required only in the phase that consumes them.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the only currently documented integration values allowed in browser code. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` must be represented only by the server schema.
- GitHub Actions is the proposed basic CI provider. This creates repository files only and does not create or modify a remote repository.
- Package installation requires registry access during implementation.

## Design

### Application shell

Create the smallest valid App Router application:

- `app/layout.tsx` defines document metadata and the root layout.
- `app/page.tsx` renders a static foundation-state page with no product interactions or fabricated operational claims.
- `app/globals.css` provides minimal accessible base styling without introducing a component library or CSS framework.

The shell proves that development and production builds work. It is not an MVP screen and should be easy to replace in later phases.

### TypeScript and module boundaries

Enable strict TypeScript, including `strict: true`, and use the framework's generated TypeScript settings where required. Avoid `any`. Configure a single root import alias such as `@/*` so later architectural directories can be introduced without deep relative imports.

Do not create empty `components`, repository, service, Supabase, or agent directory trees. Add directories only when Phase 0 has executable code for them.

### Shared results and errors

Add a small framework-independent core module with:

- The architecture error-code union: `validation_error`, `unauthenticated`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `external_service_error`, and `internal_error`.
- A discriminated `Result<T, E>` union with `ok: true` and `ok: false` variants.
- Constructors or narrow helpers for success and failure results only when they improve inference and are directly tested.
- A sanitized application-error shape that can later be mapped to HTTP responses without containing stack traces, SQL, prompts, secrets, or internal exception objects.

The module must not contain HTTP, React, Supabase, OpenAI, tenant, or business-domain logic. Expected business outcomes will use results; unexpected exceptions remain eligible for centralized logging and conversion at future server boundaries.

### Environment validation

Separate environment concerns into server-only and public modules:

- A pure schema/parser module accepts an explicit key/value object so tests never mutate global process state.
- A server-only module reads server environment variables and must never be imported by client components.
- A browser-safe module exposes only explicitly allowlisted `NEXT_PUBLIC_*` values.

Validation failures must identify the invalid variable without printing its value. Unknown environment variables must not be copied into a returned client object. Empty strings should be normalized consistently so optional placeholders do not masquerade as configured integrations.

During Phase 0, only variables needed by the shell itself may be required. Document future integration variables as optional placeholders. This keeps fresh-clone builds deterministic while still testing rejection of malformed configured URLs or invalid enum-like values.

### CI and quality gates

Add one GitHub Actions workflow for pushes and pull requests. It should:

1. Check out the source.
2. Install the pinned Node major with npm caching.
3. Run `npm ci`.
4. Run `npm run lint`.
5. Run `npm run typecheck`.
6. Run `npm test` in non-watch mode.
7. Run `npm run build`.

Use least-privilege workflow permissions (`contents: read`) and no application secrets. Do not add placeholder secret values to CI. Concurrency cancellation may be enabled for superseded runs, but the quality steps must remain visible and deterministic.

### Documentation and failure handling

The README must distinguish what Phase 0 actually provides from the later MVP vision. Setup instructions must work from a fresh clone and explain copying `.env.example` without committing `.env.local`.

Tooling and configuration failures should fail loudly with actionable messages. Public-facing error UI, API error mapping, and observability are later-phase concerns because Phase 0 has no public transaction or endpoint.

## Milestones

1. **Repository and toolchain foundation**
   - Confirm or initialize the intended Git repository root without configuring a remote.
   - Add `.gitignore`, `.nvmrc`, `package.json`, and the npm lockfile.
   - Install only the framework, TypeScript, lint, test, and schema-validation dependencies justified by this plan.
   - Add strict TypeScript, Next.js, ESLint, and Vitest configuration.
   - Verify the initial package scripts execute.

2. **Minimal executable shell**
   - Add the root layout, static foundation page, and minimal accessible styling.
   - Confirm the page contains no implied or partial product behavior.
   - Run lint, typecheck, tests, and build before moving on.

3. **Core configuration and typed patterns**
   - Add environment schemas with public/private separation and a safe example file.
   - Add shared result and sanitized error types.
   - Add unit tests for successful and failing paths.
   - Re-run all quality commands.

4. **CI, documentation, and hardening**
   - Add the least-privilege CI workflow.
   - Update README setup and phase-status documentation.
   - Perform secret and client-boundary checks.
   - Simulate the fresh-clone install using `npm ci` from the committed lockfile and run every acceptance command.
   - Review the final diff for unrelated files, generated artifacts, and invented features; update this plan's logs and completion notes.

## File changes

Expected new files:

- `.gitignore` — excludes local secrets and generated artifacts.
- `.nvmrc` — pins the supported Node.js major.
- `.env.example` — documents safe placeholders without values.
- `.github/workflows/ci.yml` — basic least-privilege quality workflow.
- `package.json` — dependencies, engine/package-manager metadata, and required scripts.
- `package-lock.json` — reproducible npm dependency graph, generated by npm.
- `next.config.ts` — minimal Next.js configuration only if the selected framework version requires or benefits from explicit configuration.
- `tsconfig.json` — strict TypeScript configuration and root alias.
- `next-env.d.ts` — framework-generated TypeScript declarations.
- `eslint.config.mjs` — lint configuration compatible with the installed Next.js version.
- `vitest.config.ts` — unit-test configuration and alias resolution.
- `app/layout.tsx` — root document layout and metadata.
- `app/page.tsx` — static foundation-state page.
- `app/globals.css` — minimal accessible styling.
- `lib/config/env-schema.ts` — pure environment schemas and parsers.
- `lib/config/env-server.ts` — server-only environment access.
- `lib/config/env-public.ts` — explicit browser-safe environment access.
- `lib/core/errors.ts` — shared error codes and sanitized error shape.
- `lib/core/result.ts` — shared discriminated result types/helpers.
- `tests/unit/env.test.ts` — environment validation and redaction tests.
- `tests/unit/result.test.ts` — result discrimination and helper tests.

Expected modifications:

- `README.md` — prerequisites, setup, scripts, environment policy, architecture boundaries, and current implementation status.
- `docs/plans/phase-0-repository-foundation.md` — progress, decisions, deviations, and completion evidence throughout implementation.
- `docs/11_DECISIONS.md` — only if implementation makes a durable architecture decision not already recorded. Routine package choices remain in this plan and `package.json`.

Files generated transiently but never committed include `node_modules/`, `.next/`, coverage output, logs, and local `.env*` files other than `.env.example`.

## Database changes

None. Phase 0 must not create Supabase configuration, migrations, tables, seed data, policies, storage buckets, or database types. Those belong to Phase 1.

No rollback or backfill is required. If later implementation accidentally generates database artifacts, remove them from the Phase 0 change and record the deviation.

## Security review

- Keep all real credentials out of source, tests, logs, build output, and CI.
- Ignore `.env`, `.env.local`, and environment-specific variants while explicitly retaining `.env.example`.
- Ensure public environment code returns only allowlisted `NEXT_PUBLIC_*` keys.
- Ensure the server environment module uses a server-only boundary and cannot be imported into a client component.
- Ensure validation errors name keys but never echo secret values.
- Do not instantiate Supabase or OpenAI clients and do not add service-role behavior in this phase.
- Use no workflow secrets and restrict GitHub Actions permissions to read-only source access.
- Pin the runtime major and lock dependencies to reduce environment and supply-chain drift.
- Review the built client output and source imports for `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; neither name should occur in emitted client assets.
- Confirm `.DS_Store`, local environment files, dependency directories, build output, coverage, and logs are ignored. Existing OS metadata should not be treated as application source.
- Tenant isolation and RLS cannot be exercised without a database. Their absence is an intentional Phase 0 boundary, not a deferred test for code introduced in this phase.

## Test plan

### Unit tests

- A valid minimal Phase 0 environment parses successfully.
- Optional future integration variables may be absent without breaking install, test, or build.
- If a documented URL variable is present with an invalid URL, parsing fails with the variable name and not its value.
- Empty optional values are normalized according to the documented rule.
- The public parser exposes only allowlisted public variables and never returns server secret keys.
- Success and failure result helpers preserve their payloads and discriminate through `ok` without casts.
- Every architecture-defined application error code is accepted by the shared error type.
- Sanitized errors cannot carry raw exception objects through their public shape.

### Static and build checks

- `npm run lint` reports no lint errors.
- `npm run typecheck` passes under strict TypeScript.
- `npm test` runs once and passes all Phase 0 unit tests.
- `npm run build` produces a successful production build without external credentials.
- Search source and emitted client assets for prohibited secret names and verify no secret values or server-only imports are exposed.
- Review dependency placement so build-only/test-only packages are development dependencies and Zod is the only additional planned runtime library.

### Manual checks

- Starting the development server on a clean local environment renders the neutral foundation page.
- The page is keyboard-readable, mobile-safe, and has no broken loading, navigation, or interactive states.
- Copying `.env.example` to `.env.local` with placeholders does not expose secrets or imply that integrations work.
- CI contains the same four quality gates used locally and requires no secrets.

### Fresh-clone simulation

From a clean checkout or disposable copy that excludes ignored/generated files:

```bash
npm ci
cp .env.example .env.local
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
```

Stop the development server after verifying the root page. Do not commit `.env.local`, `.next/`, `node_modules/`, coverage, or logs.

## Commands

Planned setup and inspection commands:

```bash
node --version
npm --version
git status --short --branch
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Use `npm install` only when establishing or intentionally updating `package-lock.json`; use `npm ci` for clean verification and CI. Use the implementation tools' normal non-interactive flags, and record the exact commands and outcomes in the progress and completion sections. If the directory remains outside a Git worktree, document that limitation rather than claiming fresh-clone or CI verification succeeded.

## Acceptance criteria

- `package.json` declares npm usage, the supported Node major, and working `dev`, `lint`, `typecheck`, `test`, and `build` scripts.
- `package-lock.json` exists and `npm ci` succeeds from a clean dependency state.
- The project uses the Next.js App Router and strict TypeScript without `any` in Phase 0 source.
- The root route builds and renders a neutral SmartDesk AI foundation page with no invented application capability.
- Environment values are schema-validated; optional unused integrations do not block Phase 0, malformed configured values fail clearly, and error messages do not reveal values.
- Server-only variables cannot be accessed through the browser-safe environment module.
- Shared results are discriminated unions and shared error codes match `docs/04_ARCHITECTURE.md`.
- `.env.example` contains placeholders only, and local environment files and generated artifacts are ignored.
- CI runs `npm ci`, lint, typecheck, unit tests, and build using the same Node major as local development and no secrets.
- `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` all complete successfully.
- README setup instructions are sufficient for a developer starting from a fresh clone.
- No Supabase, OpenAI, authentication, chat, dashboard, database, or other later-phase product feature is implemented.
- The final review finds no credential material, generated build output, unrelated edits, or unrecorded deviation.
- The progress log, decision log, and completion notes contain the actual implementation evidence rather than planned claims.

## Progress log

- [x] Read the required repository, product, architecture, security, roadmap, and planning documents.
- [x] Inspect the current repository and local Node/npm/Git state.
- [x] Create the Phase 0 execution plan.
- [x] Confirm or initialize the intended Git repository root before relying on Git-based review or CI.
- [x] Initialize the npm/Next.js/TypeScript toolchain and commit a reproducible lockfile.
- [x] Add the minimal executable application shell.
- [x] Add environment validation and public/private boundaries.
- [x] Add shared result and error primitives.
- [x] Add and pass Phase 0 unit tests.
- [x] Add basic least-privilege CI.
- [x] Update root documentation.
- [x] Run the fresh-clone simulation and all quality gates.
- [x] Complete security checks and final diff review.
- [x] Record completion evidence and remaining limitations.

## Decision log

- 2026-08-06: Limit Phase 0 to executable repository foundations. Supabase and OpenAI setup remain in their roadmap phases so the foundation build requires no external credentials.
- 2026-08-06: Propose npm with a committed lockfile because repository instructions already define npm commands and npm is available locally.
- 2026-08-06: Propose Node.js 24 as the pinned major because it matches the inspected environment. Confirm this before dependency installation and keep local, package, README, and CI declarations synchronized.
- 2026-08-06: Propose the App Router because the architecture specifies the `app/` layout and no competing router exists.
- 2026-08-06: Propose Vitest for small, fast TypeScript unit tests and defer browser E2E tooling until a real journey exists.
- 2026-08-06: Propose Zod as the schema-validation runtime dependency so environment parsing follows the repository-wide external-input validation rule.
- 2026-08-06: Propose GitHub Actions for basic CI with read-only permissions and no secrets. Remote creation and configuration remain outside this plan.
- 2026-08-06: Keep future integration credentials optional in Phase 0. Requiring unused OpenAI or Supabase secrets would violate the fresh-clone goal and couple foundation checks to later phases.
- 2026-08-06: Resolved current stable versions as Next.js 16.3.0 and React 19.2.8. Used ESLint 9.39.5 and TypeScript 6.0.3 instead of their newer majors because Next's current lint plugins declare compatibility through ESLint 9 and TypeScript below 6.1.
- 2026-08-06: Added Prettier because no formatter existed. Formatting checks cover Phase 0 source and configuration while pre-existing product and agent documentation is excluded to avoid unrelated rewrites.
- 2026-08-06: Added the `server-only` marker as a direct runtime dependency so private environment access has a framework-enforced client import boundary.
- 2026-08-06: Added `next.config.ts` with `agentRules: false` because Next.js 16 otherwise mutates the repository-owned `AGENTS.md` during development. Repository instructions remain authoritative and user-owned.
- 2026-08-06: Initialized local Git metadata with the `main` branch. No remote was created or configured.
- 2026-08-06: Audit correction wires server environment validation into the root server layout, pins GitHub Actions v6 to immutable official commit SHAs, and makes CI install the repository's declared npm 11.12.1 before `npm ci`.

## Completion notes

Phase 0 is complete. The repository now has a minimal Next.js 16.3.0 App Router shell, strict TypeScript, ESLint, Prettier, Vitest, Zod-based environment validation, server/browser environment boundaries, shared typed results and sanitized error categories, a committed npm lockfile, root setup documentation, and least-privilege GitHub Actions CI.

Verification performed on 2026-08-06 with Node.js 24.15.0 and npm 11.12.1:

- `npm_config_cache=/tmp/smartdesk-phase0-npm-cache npm ci --offline --no-audit --no-fund` — passed; 386 packages installed from the lockfile.
- `npm run lint` — passed with no findings.
- `npm run format:check` — passed; all included files match Prettier rules.
- `npm run typecheck` — passed under strict TypeScript.
- `npm test` — passed; 2 test files and 8 tests.
- `npm run build` — passed; the root and framework not-found routes were statically generated.
- `npm run dev -- --hostname 127.0.0.1` plus a local `curl` request — passed; the server became ready and the root route returned HTTP 200 with the neutral foundation page.
- Client-output secret-name scan — passed; `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` were absent from `.next/static`.
- Repository secret-pattern scan — passed; no populated OpenAI or Supabase credentials were found.
- Invalid-environment build using a deliberately malformed `APP_BASE_URL` — failed safely as expected, named only `APP_BASE_URL`, and did not echo the supplied value.
- Initial staged-diff, secret, scope, and ignored-artifact review — passed. Pre-existing intentional Markdown hard breaks in `docs/09_TESTING_AND_ACCEPTANCE.md` were excluded from the whitespace-only check.
- Initial Phase 0 commit `4dc7c1e` was pushed to `origin/main` at `https://github.com/sigala000/smartdesk-ai-starter.git`.
- Disposable clone of `origin/main` at `7b7d75d` — passed `npm ci`, lint, strict typecheck, all 8 tests, and production build using Node.js 24.15.0 and npm 11.12.1.
- GitHub Actions run `31094552038` for commit `7b7d75d` — completed successfully with the pinned actions and declared npm version.

Implementation deviations and recoveries:

- The first broad `npm run format` invocation normalized whitespace in some existing Markdown files before documentation paths were excluded. No product wording or behavior was intentionally changed; subsequent formatter runs exclude `.agent/`, `docs/`, `AGENTS.md`, and `PROJECT_TREE.txt`.
- Registry access was restricted in the sandbox during the first clean-install attempt. After completing the cache with approved npm access, an offline `npm ci` succeeded and the complete quality suite passed from that clean install.
- The initial attempt to start the development server was denied permission to bind `0.0.0.0:3000`; the authorized loopback-only retry succeeded.

Remaining limitations are intentional: there is no Supabase, authentication, tenant isolation implementation, dashboard, chat, OpenAI integration, API, or business workflow. Those product capabilities belong to later phases.

# Plan: Phase 2 Employee Authentication and Shell

## Goal

Deliver the Phase 2 employee entry boundary: an administrator-provisioned BuildPro employee can sign in with Supabase Auth, have a server-validated session resolved to exactly one active organization membership and role, enter a protected dashboard shell, see navigation and account information appropriate to that role, and sign out. Unauthenticated users, authenticated non-members, deactivated members, and ambiguous multi-membership users must fail closed without receiving tenant data.

This plan is for Phase 2 only. It must not implement request listing, request details, assignment, status transitions, notes, customer chat, attachments, human handoffs, or OpenAI behavior.

## User value

Employees receive a secure, understandable entrance to SmartDesk AI. BuildPro can verify that authentication, tenant resolution, deactivation, and role authorization work before request-management capabilities are placed behind them in Phase 3.

## Current state

As inspected before writing this plan:

- The repository is on `main`, synchronized with `origin/main`, with no tracked changes.
- Next.js 16.3.0 uses the App Router with React 19.2.8 and strict TypeScript 6.0.3.
- `app/layout.tsx` validates server environment variables; `app/page.tsx` is a Phase 1 foundation page. There are no login, logout, dashboard, protected-route, loading, or authentication-error pages.
- There are no Supabase JavaScript/SSR client dependencies or runtime client factories. The only Supabase runtime artifact under `lib/supabase/` is generated database typing.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exist in the environment schema and `.env.example`, but remain optional and are described with obsolete Phase 1 comments. `SUPABASE_SERVICE_ROLE_KEY` is server-only and is not needed for ordinary Phase 2 login or membership resolution.
- Supabase CLI 2.111.0 and local project configuration exist. Local Auth is enabled, email/password signup is currently enabled, email confirmation is disabled, and the minimum password length is six. These defaults are not yet an approved employee-account policy.
- Phase 1 migrations define `organizations` and `organization_members`. Each member references `auth.users`, has a checked role, optional same-tenant department, `display_name`, and `is_active`; `(organization_id, user_id)` is unique.
- Phase 1 RLS is deny-by-default for anonymous clients. Authenticated organization and membership reads require an active membership. The helper functions derive the user from `auth.uid()`; deactivated members therefore lose RLS-backed access.
- The production-safe BuildPro seed creates the fictional organization, three departments, six services, and approved knowledge. It intentionally creates no Auth user or reusable password.
- pgTAP tests cover schema integrity, RLS tenant isolation, reference generation, and security hardening. Vitest currently runs Node-based unit tests only. There is no browser end-to-end framework.
- CI has separate quality and database jobs. Quality runs lint, formatting, type checking, Vitest, and build. The database job resets/seeds the database, lints SQL, runs pgTAP/concurrency tests, and checks generated database types.

### Documentation alignment and non-blocking gaps

The product, architecture, schema, API, security, testing, and roadmap documents agree that Phase 2 must use Supabase Auth, active membership resolution, role-aware authorization, protected routes, and deactivation handling. No document requires request-management behavior in this phase.

The following choices are not fully specified and are resolved conservatively for Phase 2:

- **Login method:** use email and password for administrator-provisioned employee accounts. Disable public signup. Password reset, invitations, SSO, MFA, and self-registration are later decisions.
- **Email verification:** hosted employee accounts must be created or invited by an administrator and have a verified email before access. Local automated fixtures may create confirmed test users through test-only administrative setup.
- **Multiple active memberships:** because no organization switcher or active-organization persistence contract is documented, membership resolution requires exactly one active membership. Zero memberships returns an unauthorized/deactivated state; more than one returns an ambiguous-membership state and no dashboard access. This fails closed and avoids silently selecting a tenant. A future ADR may introduce an explicit tenant selector.
- **Role-aware navigation:** Phase 2 will only render destinations that actually exist in the authentication/dashboard shell. It will not add dead request-management links. Authorization helpers and navigation rules will be structured for later entries, but hidden UI will never be treated as enforcement.

These are recorded in the decision log and do not block planning.

## Scope

Phase 2 includes:

- Supabase browser and server client integration using cookie-based SSR sessions.
- Public employee login page with email/password validation and safe error messages.
- Server action or route for login and a server-only logout action.
- Session refresh plumbing compatible with the repository's Next.js version.
- Authoritative server-side session validation with `getUser()` or the current Supabase verified-user equivalent; never authorize from unverified client state alone.
- Active membership query, organization resolution, and role resolution using the authenticated user's token and RLS.
- A typed employee access context containing only the authenticated user, active membership, organization, role, and department identifiers/display fields needed by the shell.
- Protected `/dashboard` route group/layout.
- Deactivated-member, authenticated-non-member, ambiguous-membership, unauthenticated, and forbidden handling.
- Dashboard shell, responsive navigation, basic organization/member/role display, loading state, error boundary, and empty-safe rendering.
- Role-aware navigation derived from a centralized permission model.
- Unit, database/RLS, route/service integration, and focused browser authentication tests.
- Safe local test employee provisioning that is never part of the production seed.
- Documentation and CI changes needed to reproduce Phase 2.

## Out of scope

- Request list, request detail, search, filtering, assignment, statuses, notes, audit-history UI, or any Phase 3 operation.
- Customer accounts, public chat authentication, conversation tokens, and status-verification challenges.
- Employee invitation UI, member administration UI, organization switching, profile editing, password reset, email-change flows, SSO, social OAuth, magic links, MFA, CAPTCHA, or account recovery.
- Service-role-backed dashboard reads. Ordinary employee reads must use the employee session and RLS.
- Supabase Storage, attachment access, signed URLs, OpenAI, notifications UI, analytics, and production WhatsApp.
- Production employee credentials in migrations, seeds, repository files, CI logs, or `.env.example`.
- A broad permission redesign for Phase 3. Phase 2 establishes reusable authentication and coarse shell-navigation authorization only.

## Dependencies and assumptions

- Phase 0 and Phase 1 remain complete and green.
- The hosted and local schemas contain the applied Phase 1 migrations and generated types match them.
- Implementation will install the current repository-compatible `@supabase/supabase-js` and `@supabase/ssr` versions as direct dependencies and commit the resulting lockfile. Exact versions must be selected and verified at implementation time rather than guessed in this plan.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` become required for runtime authentication environments. The anon/publishable key is browser-safe; the service-role key remains optional for Phase 2 application runtime and server-only.
- Local integration/end-to-end checks require the full local Supabase stack including Auth and API services, not the database-only CI startup command.
- BuildPro employee accounts are provisioned separately from production-safe reference seed data. The account's `auth.users.id` must have one matching active `organization_members.user_id` row.
- Hosted Auth settings require a manual review because migrations do not fully manage hosted project Auth configuration.
- Route examples use `/login` and `/dashboard`. Query-string redirects must be allowlisted to internal paths to avoid open redirects.

## Design

### Authentication flow

1. An unauthenticated employee opens `/login`.
2. The server checks for an already valid user. A fully authorized employee is redirected to `/dashboard`; an invalid/stale session is treated as signed out.
3. The login form submits email and password to a server action. A Zod schema trims/normalizes the email, validates shape and bounded lengths, and requires a non-empty bounded password without logging either value.
4. The action creates a cookie-aware server Supabase client and calls email/password sign-in.
5. After sign-in, the server validates the returned identity with the authoritative Auth user endpoint, then resolves membership through RLS.
6. Exactly one active membership in an active organization produces the employee access context. Zero active memberships, an inactive organization, or multiple active memberships clears or rejects access and returns a safe state.
7. Successful login redirects to an allowlisted internal destination, defaulting to `/dashboard`.
8. Invalid credentials return one generic message. The response must not disclose whether an email exists, membership state for an unauthenticated attempt, SQL details, tokens, or internal identifiers.

### Session and Supabase client boundaries

Create separate, narrowly named factories:

- A browser client for browser-safe Auth interactions only when a client component genuinely needs it.
- A server client that reads/writes the Next.js cookie store for server components and server actions.
- Request-level session refresh plumbing using the Next.js 16 `proxy.ts` convention if confirmed by the installed framework and Supabase SSR APIs during implementation.

The refresh layer keeps cookies current but is not the authorization boundary. Every protected server render/action must call the central access resolver. Client-side `getSession()` data, decoded JWT claims, cookies, route hiding, and middleware/proxy checks alone are insufficient authorization.

No Phase 2 client may import `env-server.ts` or receive `SUPABASE_SERVICE_ROLE_KEY`. The browser may receive only the configured public Supabase URL and anon/publishable key.

### Active membership and role resolution

Implement a server-only resolver with a typed result, for example:

```text
authorized { user, organization, membership, role }
unauthenticated
membership_required
membership_inactive
organization_inactive
membership_ambiguous
internal_error
```

Expected behavior:

- Validate the current Auth user on the server.
- Query `organization_members` using the user's cookie-backed Supabase client so RLS evaluates `auth.uid()`.
- Join or separately load the related active organization and optional department with the same authenticated client.
- Never accept `organization_id`, member ID, or role from form data, URL parameters, local storage, user metadata, or browser claims.
- Require exactly one active membership for Phase 2.
- Treat no RLS-visible membership as unauthorized. If the UI must distinguish a recently deactivated member from a generic non-member, use the same safe member-access message unless a privileged server lookup is explicitly justified; do not introduce the service role merely to reveal that distinction.
- Check both membership `is_active` and organization `is_active`.
- Validate the database role against a closed TypeScript role union matching the database constraint. An unknown role fails closed.
- Avoid cross-request caching of user-specific access context. Request-local memoization is acceptable if it cannot cross cookie/session boundaries.

### Authorization and permissions

Create framework-independent role/permission helpers. Initial roles must match the Phase 1 check constraint:

- `admin`
- `manager`
- `commercial_officer`
- `technical_officer`
- `project_manager`
- `support_officer`
- `viewer`

Phase 2 permissions are limited to shell destinations and basic account/organization display. The centralized helper must support `can(role, permission)` and default-deny unknown role/permission combinations. Server layouts/pages/actions call authorization helpers before returning protected content. Navigation consumes the same permission map only to improve presentation; filtering a link never grants or revokes access.

Any role-limited Phase 2 page must independently call `requirePermission`. Direct URL tests must prove a user cannot bypass navigation by typing the path. No request-domain permission is implemented until Phase 3 defines its behavior.

### Route behavior

- `/login`: public, accessible, and redirects only an already authorized employee to `/dashboard`.
- `/dashboard`: protected server layout and shell. Unauthenticated requests redirect to `/login` with a safe internal return path.
- Authenticated users without one valid active membership render a dedicated access-unavailable page or redirect to a stable `/unauthorized` state that reveals no tenant data.
- Role-forbidden direct requests render a 403-style state without leaking whether unrelated tenant resources exist.
- Logout is a POST-backed server action, invalidates the Supabase session, and redirects to `/login`. It must not be a state-changing GET link.
- The public home page may offer a login link, but Phase 2 must not invent customer features.

### Dashboard shell and account display

The shell contains:

- SmartDesk AI and active organization identity.
- Employee display name from `organization_members`, role label, and optional department label.
- A small accessible navigation region generated by the role-aware configuration.
- A logout form/button.
- Main content outlet, mobile-responsive layout, visible keyboard focus, semantic landmarks, and no color-only status cues.
- Dashboard landing content limited to authentication/account context and a clear statement that request management arrives in Phase 3. It must not query or summarize requests.

Role-aware navigation must include only implemented Phase 2 destinations. If an organization/account destination is role-limited, its page must provide genuine basic organization/account information and enforce the same permission server-side; do not add disabled or dead links merely to demonstrate filtering.

### Loading, error, and access states

- `app/dashboard/loading.tsx` provides an accessible, non-sensitive loading state.
- `app/dashboard/error.tsx` provides a client error boundary with a retry control and sanitized copy; it must not print exception messages, tokens, or database errors.
- Login shows pending state, prevents accidental repeated submissions, retains only the email when safe, and never repopulates the password.
- Invalid credentials use a generic error.
- Expired or revoked sessions redirect to login.
- Deactivated/non-member/ambiguous membership states explain that access is unavailable and direct the employee to an administrator without naming another organization.
- Logout failure clears application access as safely as the SDK permits and returns a sanitized recoverable state.

## Milestones

### 1. Authentication foundation

- Add compatible Supabase JS and SSR dependencies.
- Make Phase 2 public Auth environment variables conditionally/operationally required with tests.
- Add browser/server client factories and cookie refresh plumbing.
- Harden local employee Auth configuration and document hosted equivalents.

### 2. Access-context and authorization core

- Add closed role and permission types.
- Implement server-side user validation and exactly-one-active-membership resolution.
- Add server guards for authentication and permissions.
- Add database/RLS regression cases for active, inactive, cross-tenant, and multi-membership users.

### 3. Login, logout, and dashboard shell

- Build accessible login form and server action.
- Build POST-backed logout.
- Add protected dashboard layout, account display, role-aware navigation, and safe landing page.
- Add loading, error, unauthenticated, unauthorized, deactivated, and ambiguous-membership states.

### 4. Tests, CI, and hardening

- Add unit and integration tests for schemas, permission maps, membership result mapping, redirects, and direct-route authorization.
- Add focused browser tests for login/logout/session/deactivation if the chosen test tool is justified.
- Run local Auth/RLS/database and clean-checkout verification.
- Update README, project tree, plan logs, and ADRs for delivered decisions.

## Database changes

No new product table is expected. The existing `auth.users`, `organizations`, and `organization_members` relationship is sufficient.

During implementation, add a forward-only migration only if testing demonstrates that safe membership resolution needs a database change. Any such change must:

- Preserve the existing active-membership and tenant-isolation semantics.
- Remain version-controlled and repeatable.
- Avoid embedding employee credentials.
- Include pgTAP coverage and regenerated database types.
- Be deployed and post-checked separately from hosted Auth configuration.

Preferred design: query the existing tables with the authenticated user's RLS-bound server client. Do not create a broad `SECURITY DEFINER` membership endpoint or use the service role unless a documented, reviewed need arises.

Potential database test additions, without changing schema:

- Active member can read only their own active membership and organization.
- Deactivated member cannot read membership, organization, department, or tenant-owned operational rows.
- Authenticated user with no membership sees no tenant rows.
- A user cannot derive or select an active organization by supplying another tenant ID.
- A member in organization A cannot resolve a role or department in organization B.
- Multiple active memberships are observable only to that user under current RLS and are rejected by the application resolver until selection is implemented.

## Supabase Auth configuration

Local configuration should be intentionally aligned with the employee-only entry model:

- Keep anonymous sign-in disabled.
- Disable public email signup for the application flow; employee accounts are administrator-provisioned.
- Use email/password sign-in for Phase 2.
- Raise the local minimum password policy to a documented reasonable value compatible with hosted settings.
- Retain refresh-token rotation.
- Restrict site URL and additional redirect URLs to exact approved local/hosted application URLs.
- Do not commit SMTP, OAuth, CAPTCHA, signing, or service-role secrets.

Hosted settings require a manual checklist because `supabase/config.toml` does not automatically control all linked hosted Auth settings. Before declaring Phase 2 hosted-ready, verify signup, email verification/invite policy, password policy, redirect allowlist, token settings, and the provisioned BuildPro employee/membership pair.

## File changes

Expected files to create:

```text
app/(auth)/login/page.tsx
app/(auth)/login/login-form.tsx
app/(auth)/login/actions.ts
app/(auth)/unauthorized/page.tsx
app/dashboard/layout.tsx
app/dashboard/page.tsx
app/dashboard/loading.tsx
app/dashboard/error.tsx
app/dashboard/actions.ts
components/dashboard/dashboard-shell.tsx
components/dashboard/dashboard-navigation.tsx
components/auth/logout-button.tsx
lib/auth/access-context.ts
lib/auth/auth-errors.ts
lib/auth/login-schema.ts
lib/auth/permissions.ts
lib/auth/require-access.ts
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/proxy.ts
proxy.ts
tests/unit/auth/login-schema.test.ts
tests/unit/auth/permissions.test.ts
tests/unit/auth/access-context.test.ts
tests/integration/auth/employee-authentication.test.ts
tests/integration/auth/protected-routes.test.ts
tests/e2e/employee-authentication.spec.ts
supabase/tests/005_employee_authentication.sql
```

Exact component splits may be simplified during implementation. Do not create empty abstractions.

Expected files to modify:

```text
package.json
package-lock.json
.env.example
lib/config/env-schema.ts
lib/config/env-public.ts
lib/config/env-server.ts
tests/unit/env.test.ts
vitest.config.ts
supabase/config.toml
.github/workflows/ci.yml
app/globals.css
app/page.tsx
README.md
PROJECT_TREE.txt
docs/11_DECISIONS.md
docs/plans/phase-2-employee-authentication.md
```

Conditionally modified only if a real schema/policy correction is required:

```text
supabase/migrations/<timestamp>_phase_2_employee_auth.sql
lib/supabase/database.types.ts
```

The implementation must inspect installed Next.js and Supabase SSR APIs before finalizing filenames. If the framework requires a different session-refresh convention, record the deviation in this plan.

## Security review

### Authentication

- Authorize only after server-side verified-user validation.
- Use secure, HTTP-only cookie behavior supplied by the SSR integration; production cookies travel only over HTTPS.
- Rotate/refresh sessions through supported SSR primitives.
- Reject stale, malformed, revoked, and missing sessions.
- Use generic credential errors to resist account enumeration.
- Disable application self-signup and do not expose admin account creation.

### Authorization and tenant isolation

- Derive user ID from verified Auth state and organization/role from an active database membership.
- Never trust user metadata, browser state, form fields, or URL parameters for role or tenant scope.
- Check organization activity as well as member activity.
- Require server authorization at each protected layout/page/action. UI visibility is presentation only.
- Preserve RLS as defense in depth and use the authenticated employee client for normal access.
- Fail closed on zero, unknown, inactive, or multiple membership results.
- Add explicit cross-tenant and direct-URL negative tests.

### Secrets and privacy

- Browser code may use only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Never import or serialize the service-role key into a client component.
- Do not log passwords, cookies, access/refresh tokens, full Auth responses, or raw database errors.
- Render only basic account data needed by the employee; do not expose auth provider metadata or another tenant's existence.
- Search source and emitted client assets for forbidden secret names/values during verification.

### Redirects and request handling

- Allow only relative, approved internal return paths.
- Login and logout mutations use POST/server actions and CSRF protections inherent to the chosen Next.js mechanism; do not implement state-changing GET routes.
- Validate all form inputs with bounded schemas.
- Return sanitized typed errors consistent with repository error categories.

### Deactivation timing

A valid Auth token may outlive membership deactivation. Therefore every protected server navigation/action resolves active membership again rather than treating a prior dashboard render as permanent authorization. RLS independently denies tenant rows after `is_active` becomes false. Realtime forced logout is not required; the next protected request must fail.

## Test plan

### Unit tests

- Login schema accepts normalized valid email/password input and rejects empty, oversized, or malformed values.
- Permission map covers every database role, denies unknown roles, and returns only allowed shell navigation.
- Membership-result mapping handles zero, one, multiple, inactive-organization, and unknown-role results.
- Redirect sanitizer accepts approved internal paths and rejects absolute, protocol-relative, encoded, or malformed destinations.
- Auth errors map to generic public messages without leaking provider details.

### Database and RLS tests

- Authenticated active member reads their membership and active organization.
- User A cannot resolve or read organization B's membership, department, or organization.
- Deactivated user reads no tenant rows even with a still-valid JWT subject.
- Authenticated user without membership reads no tenant rows.
- Role comes only from the matching active membership.
- Multiple memberships remain tenant-scoped; application tests prove the resolver rejects ambiguity.
- Anonymous roles retain no broad membership or organization access.

### Integration tests

- Valid credentials plus exactly one active membership produce an authorized access context.
- Invalid credentials do not create a session and return a generic error.
- A valid Auth user with no membership cannot enter `/dashboard`.
- A deactivated member with an otherwise valid session is denied on the next protected request.
- An inactive organization is denied.
- A user with multiple active memberships is denied pending selection.
- Unauthenticated `/dashboard` redirects to `/login` with a sanitized internal return path.
- Direct access to any role-limited shell route is denied even when its link is hidden.
- Login cannot select a tenant or role supplied by the browser.
- Logout revokes/clears the session and subsequent dashboard access redirects to login.
- Expired and malformed cookies fail safely.

Prefer real local Supabase for Auth/RLS integration and test doubles only for deterministic provider-failure branches. Do not mock away the session/RLS boundary in the tests that claim to prove it.

### End-to-end tests

If a browser framework is added, select the smallest current tool compatible with Next.js and local Supabase, justify it, and include it in CI. Cover:

- BuildPro employee login to dashboard.
- Visible account/organization/role display.
- Keyboard-accessible logout and post-logout protection.
- Invalid login error and pending state.
- Expired session redirect.
- Deactivation while signed in, followed by denial on navigation/refresh.
- Direct URL authorization independent of navigation visibility.
- Responsive shell smoke check.

If implementation deliberately defers a browser framework, the plan must be updated with equivalent route integration tests plus a documented manual browser checklist; it may not silently claim end-to-end coverage.

### Manual hosted checks

- Provision one fictional BuildPro employee through the hosted Auth administrator workflow without committing credentials.
- Add exactly one active BuildPro `organization_members` row referencing that Auth user.
- Confirm verified employee login, dashboard identity, refresh, logout, and protected redirect.
- Deactivate the membership and confirm the next protected navigation loses access.
- Reactivate only after the test if continued access is intended.
- Confirm a non-member Auth user receives no tenant data.
- Confirm the browser bundle and network responses contain no service-role key or unrelated organization data.
- Review hosted Auth redirect, signup, verification/invite, password, and token settings.

## Commands to run during implementation

Dependency and application checks:

```bash
npm install @supabase/supabase-js @supabase/ssr
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

Local Supabase and database checks:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types:check
npm run db:stop
```

If an end-to-end runner and scripts are added, use the repository script rather than an ad hoc command, for example:

```bash
npm run test:e2e
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

The disposable checkout must also run the relevant local Supabase/Auth integration suite when Docker is available. Record every command actually run and its result; do not claim unexecuted checks passed.

## Acceptance criteria

- [x] A provisioned, verified BuildPro employee with exactly one active membership can sign in and reach `/dashboard`.
- [x] Login inputs are schema-validated and invalid credentials produce a generic accessible error.
- [x] Public self-signup is unavailable in the application and local/hosted Auth settings are documented.
- [x] The server validates the Auth user and resolves organization, member, department, and role from the database—not browser-supplied claims.
- [x] An unauthenticated user cannot render dashboard content and is redirected safely to login.
- [x] An authenticated user with no membership cannot render dashboard content or obtain tenant data.
- [x] A deactivated member loses access on the next protected request despite any unexpired Auth token.
- [x] An inactive organization cannot be used as an active context.
- [x] Multiple active memberships fail closed until an explicit selection design is approved.
- [x] A member of organization A cannot resolve or view organization B's membership, role, department, organization, or shell data.
- [x] Every protected page/action enforces authorization server-side; typing a hidden route directly does not bypass it.
- [x] Dashboard navigation is generated from the closed role/permission map and contains no dead Phase 3 links.
- [x] The dashboard shell displays only basic authorized employee and organization information and includes accessible loading, error, unauthorized, and empty-safe states.
- [x] Logout is a state-changing server operation, clears the session, and prevents subsequent dashboard access.
- [x] The service-role key is absent from browser code, browser bundles, public responses, logs, seeds, and test fixtures.
- [x] Auth/RLS tests include active, inactive, non-member, multiple-membership, and cross-tenant negative cases.
- [x] Lint, formatting, strict type check, unit/integration tests, database tests, generated-type check, production build, and clean lockfile installation pass.
- [x] README, project tree, ADRs, environment example, CI, and this plan accurately describe delivered Phase 2 behavior and remaining limitations.
- [x] No request-management, customer chat, attachment, or OpenAI feature is introduced.

## Progress log

- [x] Read repository instructions and the execution-plan standard.
- [x] Read the documentation index and all authentication/backend/large-feature planning documents required by it.
- [x] Read the user-requested product, architecture, schema, API, security, testing, and roadmap documents.
- [x] Inspect the current Next.js application, strict TypeScript, dependencies, scripts, environment validation, tests, CI, Supabase Auth configuration, schema, RLS, generated types, seeds, and existing plans.
- [x] Confirm Phase 2 documentation has no blocking contradiction with the repository.
- [x] Create the Phase 2 execution plan without implementing it.
- [x] Review and approve this plan before implementation.
- [x] Milestone 1: authentication foundation.
- [x] Milestone 2: access-context and authorization core.
- [x] Milestone 3: login, logout, and dashboard shell.
- [x] Milestone 4: automated tests, local browser verification, CI configuration, documentation, and clean lockfile installation.
- [x] Complete the implementation acceptance checklist; hosted provisioning remains a documented manual deployment step.
- [x] Record implementation commands, results, deviations, and limitations in completion notes.

## Decision log

- 2026-08-07: Phase 2 uses administrator-provisioned email/password employee accounts. Public signup, invitations UI, recovery, SSO, OAuth, magic links, and MFA remain out of scope.
- 2026-08-07: Server-side verified-user validation plus an RLS-bound membership query is the authorization foundation. Cookie presence, decoded claims, and hidden UI are never sufficient.
- 2026-08-07: Phase 2 requires exactly one active membership in an active organization. Zero or multiple matches fail closed because organization switching and active-tenant persistence have no approved contract.
- 2026-08-07: The authenticated employee Supabase client is preferred for membership and shell data. The service-role key is not needed for ordinary Phase 2 behavior.
- 2026-08-07: Session refresh plumbing improves continuity but protected server layouts/pages/actions must independently resolve current access.
- 2026-08-07: Role-aware navigation includes only real Phase 2 destinations. Authorization is independently enforced at the destination and is never based on link visibility.
- 2026-08-07: No new product table or migration is assumed. A forward migration is permitted only if implementation evidence reveals a necessary schema/RLS correction.
- 2026-08-07: Installed `@supabase/supabase-js` 2.112.2 and `@supabase/ssr` 0.12.4. Next.js 16 uses the root `proxy.ts` convention for session refresh.
- 2026-08-07: Global Auth signup is disabled, while the email provider stays enabled. Local integration proved that disabling `[auth.email].enable_signup` also disables password login for provisioned users.
- 2026-08-07: A permanent browser-test dependency was not added. Real Supabase password/session/RLS behavior is automated by `scripts/test-employee-auth.mjs`, and `scripts/test-auth-routes.mjs` exercises the rendered Next.js authorization boundary over HTTP against local Auth. The complete form journey was additionally verified in a local browser.
- 2026-08-07: Logout attempts global revocation and falls back to local session cleanup. Both failures produce a sanitized error state rather than a false success message.

## Known risks and limitations

- Users with legitimate memberships in multiple organizations cannot enter the dashboard until an explicit organization-selection workflow is designed. This is a safe limitation, not silent tenant selection.
- Email delivery, invitations, password reset, MFA, and account recovery are not delivered in Phase 2. Hosted employee provisioning remains an administrator operation.
- Deactivation is enforced on the next protected server request and by RLS; Phase 2 does not promise immediate push-driven browser termination.
- The current database role list is coarse. Phase 3 must define request-domain permissions before request actions are exposed.
- Local Auth configuration does not automatically update all hosted Auth settings. Hosted review and manual provisioning remain required.
- A full browser end-to-end runner is not installed. Auth/RLS and protected-route behavior are automated through local Supabase and an HTTP-level Next.js harness, while the form journey was manually browser-verified; future UI expansion may justify a dedicated browser suite.
- No request counts, queues, operational metrics, or business-data navigation appear in the Phase 2 dashboard shell.

## Completion notes

Implemented Phase 2 employee authentication and the dashboard shell without starting request management.

Delivered:

- Cookie-aware Supabase browser/server clients and Next.js session-refresh proxy.
- Email/password login with generic errors, safe internal redirects, pending state, verified server identity, and exactly-one-active-membership resolution.
- Server-protected dashboard and organization-summary routes, centralized closed roles/permissions, role-aware navigation, logout, and safe unauthenticated/expired/unauthorized/loading/error states.
- Local Auth hardening: global signup disabled, email provider enabled for provisioned employees, confirmed email accounts, 12-character minimum password, refresh rotation, and exact local redirects.
- Six unit-test groups total 20 passing assertions across the repository; the fifth pgTAP file brings database coverage to 55 assertions; the real Auth integration adds 12 boundary checks; the protected-route HTTP harness adds 9 checks; the existing concurrency runner confirms 20 unique references.

Verification evidence:

- `npm install @supabase/supabase-js@2.112.2 @supabase/ssr@0.12.4` — passed, zero reported vulnerabilities.
- `npm ci` — passed after the final lockfile update.
- `npm run format:check` — passed.
- `npm run lint` — passed after ignoring Supabase-generated `.temp` runtime files.
- `npm run typecheck` — passed under strict TypeScript.
- `npm test` — passed: 6 files, 20 tests.
- `npm run build` — passed; `/dashboard`, `/dashboard/organization`, `/login`, and `/unauthorized` are dynamic protected/auth routes and the Next.js proxy compiled.
- Isolated `supabase db reset --debug` — passed with all four migrations and the production-safe seed applied.
- `npm run db:lint` — passed with no schema errors.
- `npm run db:test` — passed: 55 pgTAP assertions, 20-way reference concurrency, 12 real Auth/RLS checks, and 9 protected-route HTTP checks.
- `npm run db:types:check` — passed with no generated-type drift.
- Secret scan across application Supabase code and `.next/static` — no service-role reference found.
- Local browser journey — passed: unauthenticated redirect/expired-session notice, employee login, authorized account display, admin navigation, direct organization-route denial after live downgrade to `viewer`, logout, and post-logout redirect.

Observed and corrected during implementation:

- Browser testing caught a non-function export in a `"use server"` action module; the form state was moved to the client module and the full journey then passed.
- The post-implementation audit found no automated HTTP route boundary and a logout fallback that could report false success. A local Next.js/Supabase route harness and explicit two-stage sign-out result handling now cover both cases.
- The local Supabase CLI twice returned from a combined reset wrapper before the restored database was fully rebuilt, exposing the prior 20-reference counter. An isolated reset was required; after migrations and seed completion were explicitly confirmed, all 55 tests and both Node integration runners passed. No reference assertion was weakened.

Manual hosted setup remains: configure hosted Auth settings to match the documented policy, add the deployed application URL/redirect allowlist, provision and verify an employee through the Supabase administrator interface, create exactly one active BuildPro membership referencing that Auth user, and perform the documented hosted login/deactivation/logout checks. No credentials are committed.

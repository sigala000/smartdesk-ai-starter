# Plan: MVP Experience and WhatsApp Remediation

## Goal

Deliver a cohesive, trustworthy SmartDesk AI MVP that feels finished, supports
the complete BuildPro customer and employee paths, and processes Meta WhatsApp
developer-test messages through the same conversation, confirmation, and ticket
services as web chat.

## User value

Customers get a calm, clear, mobile-first guided experience. Employees get a
usable operations workspace instead of disconnected technical pages. The pilot
owner can demonstrate that a confirmed web or WhatsApp conversation creates one
real ticket that appears in the dashboard and remains actionable.

## Current state

- The backend, RLS, deterministic workflow, agent orchestration, request
  management, handoffs, status verification, attachments, and Meta developer
  adapter exist and have substantial automated coverage.
- The visual layer is inconsistent. Several CSS classes are missing, the home
  page is a sign-in card rather than a product entry experience, the dashboard
  still contains obsolete Phase 3 wording, and dense actions are presented as
  undifferentiated forms.
- The normal local launcher can mix hosted `.env.local` values with local
  services. `dev:local` now provides a local-only boundary, but deliberately
  disables WhatsApp.
- The Meta test configuration exists locally, but an ngrok/public callback and
  current temporary Meta access token must be live for a phone test.
- The worktree contains all completed phase work and must be preserved.

## Scope

- Establish a soft neutral blue/lilac visual system with accessible contrast.
- Redesign the home, authentication, chat, status, dashboard overview, request
  list/detail/actions, organization, handoff queue, and unauthorized states.
- Add coherent navigation, active states, responsive behavior, empty/loading/
  failure/success feedback, and functional primary actions.
- Remove obsolete phase copy and expose useful dashboard summaries.
- Verify all links and buttons through browser automation.
- Run Meta developer-test WhatsApp through the existing signed webhook,
  trusted tenant mapping, shared agent/draft, explicit confirmation, and ticket
  creation path.
- Produce new customer, employee, status, handoff, and WhatsApp evidence.

## Out of scope

- Production WhatsApp onboarding or a production business number.
- Autonomous pricing, payments, voice, multiple agents, or automatic final
  quotations.
- Weakening confirmation, RLS, attachment, or service-role protections for a
  smoother demo.

## Dependencies and assumptions

- Local Supabase remains the safe automated-test environment.
- Hosted Meta developer-test verification requires the existing configured app,
  authorized recipient, temporary token, and a public HTTPS tunnel.
- The user sends a real WhatsApp message only after the callback is live and the
  assistant explicitly requests it.
- Existing application services remain the only ticket-creation path.

## Design

The interface uses a restrained slate/blue/lilac palette, generous whitespace,
rounded surfaces, a consistent typography scale, and semantic status chips.
Customer pages use a focused centered flow; employee pages use a responsive
sidebar/topbar shell and content cards. Every mutation exposes pending,
success, and safe failure states.

WhatsApp remains a channel adapter. Signed inbound text is stored first,
deduplicated by provider message ID, resolved to a tenant from trusted phone
configuration, and then passed to the same agent and deterministic draft. The
customer must explicitly confirm the stored summary before the existing
idempotent request service creates a ticket and backend reference.

## Milestones

1. Inventory and design system.
2. Customer surface redesign.
3. Employee surface redesign and interaction repair.
4. WhatsApp callback restoration and real developer-test journey.
5. Full regression, accessibility, mobile, and recorded acceptance.

## File changes

- `app/globals.css`, layouts, public pages, dashboard pages.
- Customer, dashboard, request, handoff, status, and attachment components.
- Local/test runtime scripts where environment separation needs correction.
- Playwright scenarios and relevant unit/integration tests.
- Meta test plan/manual instructions only where actual portal configuration
  differs.

## Database changes

No schema change is expected. If a functional gap genuinely requires one, use a
forward-only versioned migration with RLS and negative tests.

## Security review

- Never expose Meta, OpenAI, or service-role secrets.
- Keep organization resolution server-owned.
- Keep request creation confirmation-gated and idempotent.
- Preserve cross-tenant RLS and server-side employee authorization.
- Do not record real phone numbers, tokens, message bodies, or passwords in
  committed video/test artifacts.

## Test plan

- Lint, format, strict typecheck, unit/integration/AI/database/RLS tests, build.
- Desktop and mobile Playwright checks for every page and navigation item.
- Full web request, secure status, employee processing, and handoff scenarios.
- Mocked WhatsApp verification/signature/deduplication/provider-error tests.
- One manual signed Meta developer-test message from the authorized recipient,
  including confirmation and dashboard ticket visibility.

## Acceptance criteria

- No missing CSS class affects a rendered product page.
- Every user-visible link and enabled button reaches a working outcome.
- Customer request creation works from web and Meta developer-test WhatsApp.
- Both channels use the same stored draft, confirmation, reference, and request
  business services.
- The confirmed ticket appears in the employee dashboard.
- Desktop/mobile critical paths pass accessibility checks with no serious or
  critical automated violations.
- The app is not described as production-ready; Meta remains test-only.

## Progress log

- [x] Read the repository instructions and applicable product, journey,
      architecture, WhatsApp, and hardening documents.
- [x] Inspect routes, components, CSS coverage, environment configuration, Git
      state, and current Meta variables.
- [x] Record the remediation plan.
- [x] Complete the customer experience redesign.
- [x] Complete the employee experience redesign.
- [x] Verify the critical links, buttons, pages, and recovery states through
      desktop and mobile browser automation.
- [x] Restore and verify the Meta developer-test callback.
- [x] Run the complete quality and acceptance suites.
- [x] Record the web request/status/employee and human-handoff evidence.
- [x] Record the real Meta developer-test confirmation and remaining
      limitations.

## Decision log

- 2026-08-14: Replace the dominant dark green with accessible slate, soft blue,
  lilac, and warm-neutral accents; retain green only for success semantics.
- 2026-08-14: Keep the modular monolith and existing application services. UX
  remediation will not duplicate business logic.
- 2026-08-14: Keep production WhatsApp out of scope. The requested phone flow is
  implemented and demonstrated only against Meta's developer test number.
- 2026-08-14: Treat environment mixing as a correctness defect. Local UI testing
  must never silently mutate the hosted Supabase project.
- 2026-08-14: Persist only the non-secret conversation identifier in browser
  storage so a customer can return to the same conversation. The opaque access
  token remains in an HttpOnly cookie.
- 2026-08-14: Permit `unsafe-eval` only in development because Next.js requires
  it for its debugger; the production content-security policy remains strict.
- 2026-08-14: Darken the soft-blue primary color enough to meet WCAG AA while
  retaining the requested calm visual direction.
- 2026-08-17: Subscribe the SmartDesk Meta app to the configured developer-test
  WABA through the Graph API. Webhook-field subscription alone delivered only
  synthetic events and did not route real recipient replies.

## Completion notes

The redesigned web experience, deterministic web and WhatsApp behavior,
conversation resumption, employee workspace, secure status lookup, and human
handoff are implemented. Unit, AI, WhatsApp, database/RLS/concurrency, desktop
and mobile accessibility, security, and production-build checks pass. Recorded
web evidence is available under `artifacts/`.

A real Meta developer-test phone journey completed on 2026-08-17. A customer
selected a service, supplied the required details, skipped the optional fields,
confirmed the server-stored summary, and received backend reference
`BP-2026-000003`. A read-only database check confirmed exactly one new request,
linked to a WhatsApp conversation. The temporary ngrok callback and Meta token
remain development-only and do not change the prohibition on production
WhatsApp integration.

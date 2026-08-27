# Plan: Employee Dashboard UI Redesign

## Goal

Match the approved soft-blue dashboard references across Overview, Requests,
Human handoffs, and Organization without changing authorization or business
rules.

## User value

Employees receive a clearer hierarchy, more useful empty states, consistent
forms, responsive navigation, and visible action feedback.

## Current state

The repository has a functional permission-aware dashboard shell and page
flows, but visual hierarchy and spacing vary between pages. Shared CSS contains
older and refreshed rules, navigation uses dots instead of meaningful icons,
and empty states are visually weak.

## Scope

- Shared desktop/mobile shell, brand, workspace, account summary, icons, and
  functional request search.
- Overview cards and account status.
- Request filters, tables/cards, pagination, and empty/error states.
- Handoff tabs, cards, and empty states.
- Organization summary, profile, catalogue, employee, invitation, and action
  feedback presentation.

## Out of scope

- New business features, permissions, database changes, fake notifications,
  tenant switching, or changes to customer chat.

## Dependencies and assumptions

Existing server authorization, repositories, DTOs, and server actions remain
authoritative. The supplied screenshots are visual references, not permission
or data-model specifications.

## Design

Use semantic HTML, existing links/forms, CSS-only responsive behavior, inline
SVG icons with hidden decorative labels, and existing server data. Global
search submits to `/dashboard/requests`; controls without real behavior are not
rendered. Mobile navigation remains horizontally scrollable and keyboard
accessible.

## Milestones

1. Shared shell and navigation.
2. Overview, requests, handoffs, and organization presentation.
3. Responsive/accessibility polish.
4. Automated checks and hosted visual verification.

## File changes

- `components/dashboard/dashboard-shell.tsx`
- `components/dashboard/dashboard-navigation.tsx`
- `components/dashboard/dashboard-icon.tsx`
- dashboard page/list/filter components
- `app/globals.css`
- relevant E2E coverage

## Database changes

None.

## Security review

Navigation remains role-filtered and all server authorization remains intact.
Search accepts the existing validated request query. No tenant identifiers,
credentials, or employee-only data are added to client state.

## Test plan

Run formatting, lint, strict type checking, unit tests, production build, and
Playwright accessibility/mobile checks. Confirm no horizontal overflow and all
rendered controls have working destinations/actions.

## Acceptance criteria

- Four referenced dashboard areas share the approved soft-blue visual system.
- Desktop and mobile layouts are usable without horizontal page overflow.
- Navigation state, form labels, focus states, empty states, and feedback are
  accessible.
- No decorative non-working buttons are introduced.
- Existing authorization and business tests remain green.

## Progress log

- [x] Read repository instructions and relevant product/testing documents.
- [x] Inspect current shell, pages, components, CSS, and tests.
- [x] Redesign shared shell and navigation.
- [x] Redesign the four referenced pages.
- [x] Run all checks and visually verify.
- [ ] Deploy the reviewed result.

## Decision log

- 2026-08-27: The supplied visual references guide hierarchy, spacing, color,
  and component shape. Decorative search/notification/settings controls are
  included only when backed by a real product action.
- 2026-08-27: Retain horizontally scrollable data tables on narrow screens,
  but constrain the wrapper so the document itself never overflows.
- 2026-08-27: Hide the full desktop account panel on mobile and keep logout in
  the compact organization header.

## Completion notes

Implemented the shared shell and the four referenced dashboard areas. Browser
verification covered 1440px desktop and 390px mobile layouts, navigation, and
document overflow. Lint, strict type checking, 171 unit/integration tests, and
the production build pass. Deployment remains pending.

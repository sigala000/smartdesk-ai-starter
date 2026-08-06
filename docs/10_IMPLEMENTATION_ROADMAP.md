# Implementation Roadmap

Each phase must leave the repository in a working, testable state.

## Phase 0: Repository foundation

Deliver:

- Next.js TypeScript project
- Package scripts for lint, typecheck, test, and build
- Environment validation
- Basic CI
- Root documentation
- Shared error and result patterns

Exit criteria:

- Fresh clone can install and run.
- Quality commands pass.
- No application feature is invented beyond the docs.

## Phase 1: Supabase foundation

Deliver:

- Supabase local configuration
- Initial migrations
- Seed BuildPro organization, departments, and services
- RLS policies
- Typed database access
- RLS integration tests

Exit criteria:

- Tenant-owned tables exist.
- Cross-tenant tests fail safely.
- Seed data loads in development.

## Phase 2: Employee authentication and shell

Deliver:

- Login
- Membership resolution
- Dashboard layout
- Role-aware navigation
- Protected routes
- Deactivation handling

Exit criteria:

- Authenticated BuildPro employee enters dashboard.
- Unauthenticated and unauthorized access is blocked.

## Phase 3: Request domain without AI

Deliver:

- Request repository and service
- Request list and detail APIs
- Dashboard request list
- Assignment
- Validated status transitions
- Audit history
- Internal notes

Exit criteria:

- Seed or manually created requests can be processed end to end by employees.
- Business rules have unit tests.

## Phase 4: Public conversation and structured draft

Deliver:

- Public conversation creation
- Chat UI
- Message persistence
- Deterministic guided form fallback
- Draft field storage
- Summary and confirmation
- Idempotent request creation

Exit criteria:

- A customer can submit a request without OpenAI.
- Request appears in dashboard.
- Duplicate confirmation creates one request.

This phase is important: AI enhances the workflow; it must not be the only way the core transaction works.

## Phase 5: OpenAI agent orchestration

Deliver:

- Server-side OpenAI client
- Stable system instructions
- Bounded conversation context
- Intent and next-question behavior
- Tool definitions and executor
- Tool argument validation
- Grounded service answers
- AI test fixtures

Exit criteria:

- Agent guides the existing deterministic workflow.
- All state-changing tools use application services.
- The agent cannot create unconfirmed requests.
- Failure falls back safely.

## Phase 6: Attachments

Deliver:

- Private storage bucket
- Upload validation
- Attachment metadata
- Customer upload UI
- Employee attachment viewer
- Signed access
- Security tests

Exit criteria:

- Allowed files upload and associate correctly.
- Unauthorized access fails.
- Invalid files are rejected clearly.

## Phase 7: Human handoff and follow-up

Deliver:

- Handoff entity and API
- Customer escalation behavior
- Employee queue
- Request-more-information workflow
- Customer notification records
- Conversation ownership state

Exit criteria:

- Explicit and automatic escalation creates a visible employee task.
- The agent does not falsely claim a human is active.

## Phase 8: Status verification

Deliver:

- Challenge and verification abstraction
- Development mock provider
- Short-lived verification token
- Customer-safe request status view
- Rate limiting and lockout tests

Exit criteria:

- Reference alone reveals nothing.
- Verified customer sees only approved status data.

## Phase 9: Hardening and pilot

Deliver:

- End-to-end tests
- Accessibility review
- French localization foundation
- Logging and trace IDs
- Rate limiting
- Privacy and retention configuration
- Backup and restore procedure
- Staging deployment
- Pilot runbook

Exit criteria:

- Acceptance suite passes.
- No known critical tenant isolation issue.
- Pilot employees can use the dashboard.
- Known limitations are documented.

## Later phases

Not part of the MVP:

- Production WhatsApp integration
- Email and SMS providers
- Automated appointment slot management
- Configurable workflow builder
- Advanced reports
- CRM or Odoo integration
- Approved quotation templates
- Payments
- Multi-agent orchestration

Add them only after the web MVP demonstrates customer and employee value.

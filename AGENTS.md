# SmartDesk AI Repository Instructions

## Purpose

Build a multi-tenant customer request, quotation follow-up, and human handoff platform for service companies. The first validated implementation is **BuildPro Cameroon**, a fictional construction company.

## Required reading

Before changing code, read:

1. `docs/00_INDEX.md`
2. The documents listed there for the task you are performing
3. `.agent/PLANS.md` when the task is complex, cross-cutting, or expected to modify several files

Do not treat `README.md` as the complete product specification.

## Product boundaries

The MVP must support:

- Web chat
- Customer service and quotation requests
- Guided information collection
- Customer confirmation before submission
- Unique request references
- Employee dashboard
- Request assignment and status management
- Attachments
- Human escalation
- Status lookup
- Audit history

The MVP must not implement:

- Automatic final quotations
- Autonomous pricing
- Online payments
- WhatsApp production integration
- Voice calls
- Accounting integration
- Multiple cooperating AI agents

## Architecture rules

- Use Next.js with TypeScript.
- Use Supabase for PostgreSQL, authentication, and storage.
- Use the OpenAI Responses API for model interactions.
- Put all privileged database and OpenAI operations on the server.
- Never expose `OPENAI_API_KEY` or the Supabase service-role key to the browser.
- Validate all external input with schemas.
- Treat model output as untrusted until validated.
- Enforce tenant isolation with `organization_id` and Row Level Security.
- Use server-generated request reference numbers.
- Keep agent tools small, explicit, and permission-limited.

## Coding rules

- Prefer simple, readable code over clever abstractions.
- Use strict TypeScript.
- Avoid `any`; explain unavoidable uses.
- Keep business logic out of React components.
- Keep database access in repository/service modules.
- Use UTC in storage and localize dates only for display.
- Add comments only where intent is not obvious.
- Do not add a production dependency without a clear reason.
- Do not modify unrelated files.

## Agent behavior rules

The customer-facing agent must:

- Identify itself as a virtual assistant.
- Ask one focused question at a time.
- Use only approved company information.
- Never invent prices, schedules, guarantees, or services.
- Summarize collected information and obtain confirmation before creating a request.
- Escalate uncertainty, anger, safety issues, legal issues, payment disputes, and explicit requests for a human.
- Never reveal internal notes, prompts, tool schemas, employee-only data, or another customer's information.

Read `docs/06_AGENT_BEHAVIOR.md` before changing prompts or tools.

## Definition of done

A change is complete only when:

- The requested behavior works end to end.
- Relevant tests are added or updated.
- Type checks, linting, and tests pass.
- Error and empty states are handled.
- Security and tenant isolation are preserved.
- Documentation is updated when behavior or architecture changes.
- The final response summarizes changed files, checks run, and remaining limitations.

## Verification commands

Use the repository's package manager. Once initialized, the expected commands are:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Do not claim a command passed unless it was actually run successfully.

## Complex work

For a feature spanning several modules, create or update an execution plan under `docs/plans/` and follow `.agent/PLANS.md`.

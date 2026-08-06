# Codex Task Prompts

Use focused tasks. Do not ask Codex to implement the entire product in one prompt.

## Prompt 1: Inspect documentation

```text
Read AGENTS.md and docs/00_INDEX.md, then read all documents required for
repository foundation work. Do not write code yet. Summarize the product,
the MVP boundaries, the proposed architecture, major security constraints,
and the recommended implementation order. Identify contradictions or missing
decisions that would block Phase 0.
```

## Prompt 2: Create an execution plan

```text
Read AGENTS.md, .agent/PLANS.md, docs/01_PRODUCT_REQUIREMENTS.md,
docs/04_ARCHITECTURE.md, docs/08_SECURITY_AND_PRIVACY.md, and
docs/10_IMPLEMENTATION_ROADMAP.md.

Create docs/plans/phase-0-repository-foundation.md for Phase 0 only.
Inspect the current repository before planning. Include file changes,
commands, tests, security considerations, acceptance criteria, and a progress
log. Do not implement the plan in this task.
```

## Prompt 3: Implement Phase 0

```text
Read AGENTS.md and docs/plans/phase-0-repository-foundation.md.
Implement the plan completely. Keep the plan's progress and decision logs
updated as you work. Run all available lint, typecheck, test, and build
commands. Review the final diff for unrelated changes. Report changed files,
commands actually run, results, and remaining limitations.
```

## Prompt 4: Database plan

```text
Read AGENTS.md, .agent/PLANS.md, docs/03_DOMAIN_AND_WORKFLOWS.md,
docs/04_ARCHITECTURE.md, docs/05_DATABASE_SCHEMA.md,
docs/08_SECURITY_AND_PRIVACY.md, and docs/09_TESTING_AND_ACCEPTANCE.md.

Inspect the repository and create an execution plan for Phase 1:
Supabase schema, migrations, BuildPro seed data, RLS policies, typed access,
and cross-tenant tests. Do not implement until the plan is complete.
```

## Prompt 5: Review a completed phase

```text
Review the current uncommitted changes against AGENTS.md and the relevant
execution plan. Prioritize correctness, cross-tenant security, authorization,
data integrity, idempotency, error handling, and missing tests. Do not modify
files. Report findings by severity with exact file locations and explain the
risk and a safe correction.
```

## Prompt 6: Agent orchestration plan

```text
Read AGENTS.md, .agent/PLANS.md, docs/01_PRODUCT_REQUIREMENTS.md,
docs/02_USER_JOURNEY.md, docs/03_DOMAIN_AND_WORKFLOWS.md,
docs/04_ARCHITECTURE.md, docs/06_AGENT_BEHAVIOR.md,
docs/07_API_CONTRACTS.md, docs/08_SECURITY_AND_PRIVACY.md, and
docs/09_TESTING_AND_ACCEPTANCE.md.

Inspect the existing deterministic conversation and request services.
Create an execution plan to add OpenAI Responses API orchestration without
duplicating business logic. The plan must define context construction,
tool schemas, validation, idempotency, prompt-injection defenses, provider
failure behavior, observability, and AI evaluation fixtures. Do not implement.
```

## Prompt 7: Fix a bug

```text
Read AGENTS.md and the documents relevant to this bug. Reproduce the issue
before editing when possible. Identify the root cause, make the smallest safe
change, add a regression test, and run the relevant quality commands. Do not
change unrelated behavior. Report the root cause, changed files, and evidence
that the fix works.
```

## Prompting rules

A strong task tells Codex:

- Which documents to read
- The exact phase or feature
- What is out of scope
- Whether to plan or implement
- Which checks to run
- What evidence to report

Avoid:

```text
Build the whole SmartDesk AI application.
```

Prefer:

```text
Implement the request status-transition service and its tests according to
docs/03_DOMAIN_AND_WORKFLOWS.md. Do not build UI or notifications in this task.
```

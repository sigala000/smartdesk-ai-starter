# Execution Plans

Use an execution plan for complex features, significant refactors, database migrations, security-sensitive changes, or work spanning more than one major module.

Store active plans in `docs/plans/` using a descriptive name such as:

```text
docs/plans/request-creation-workflow.md
docs/plans/employee-authentication.md
docs/plans/openai-tool-calling.md
```

## Required qualities

Every execution plan must be:

- Self-contained
- Understandable by a developer new to the repository
- Specific about observable behavior
- Explicit about affected files and data
- Testable
- Updated as implementation progresses

## Required structure

```markdown
# Plan: <feature name>

## Goal

What working outcome will exist after this plan is complete?

## User value

Which user problem does this solve?

## Current state

What currently exists in the repository?

## Scope

What is included?

## Out of scope

What is deliberately excluded?

## Dependencies and assumptions

What must be true before implementation?

## Design

Describe data flow, components, APIs, validation, permissions, and failure handling.

## Milestones

1. Foundation
2. Core behavior
3. UI integration
4. Tests and hardening

## File changes

List expected files to create or modify.

## Database changes

List migrations, policies, backfills, and rollback considerations.

## Security review

Explain authorization, tenant isolation, secrets, input validation, and abuse prevention.

## Test plan

List unit, integration, and end-to-end scenarios.

## Acceptance criteria

State measurable completion conditions.

## Progress log

- [ ] Item
- [ ] Item

## Decision log

Record decisions and reasons as they are made.

## Completion notes

Summarize delivered behavior, commands run, and remaining limitations.
```

## Working rules

- Read the relevant product documents before writing a plan.
- Inspect the existing repository before assuming a file or pattern exists.
- Prefer incremental milestones that leave the repository working.
- Do not leave security or testing until an undefined future phase.
- Record deviations from the plan.
- Keep the plan updated after each meaningful milestone.
- When the plan is complete, retain it as implementation history.

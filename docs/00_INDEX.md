# Documentation Index

This directory contains the source-of-truth specifications for SmartDesk AI.

## Reading map

### Before any implementation

Read:

- `../AGENTS.md`
- `01_PRODUCT_REQUIREMENTS.md`
- `04_ARCHITECTURE.md`
- `08_SECURITY_AND_PRIVACY.md`

### Customer experience work

Read:

- `02_USER_JOURNEY.md`
- `03_DOMAIN_AND_WORKFLOWS.md`
- `06_AGENT_BEHAVIOR.md`
- `09_TESTING_AND_ACCEPTANCE.md`

### Database or backend work

Read:

- `03_DOMAIN_AND_WORKFLOWS.md`
- `04_ARCHITECTURE.md`
- `05_DATABASE_SCHEMA.md`
- `07_API_CONTRACTS.md`
- `08_SECURITY_AND_PRIVACY.md`

### AI prompt or tool work

Read:

- `01_PRODUCT_REQUIREMENTS.md`
- `02_USER_JOURNEY.md`
- `06_AGENT_BEHAVIOR.md`
- `07_API_CONTRACTS.md`
- `09_TESTING_AND_ACCEPTANCE.md`

### Planning a large feature

Read:

- `../.agent/PLANS.md`
- `10_IMPLEMENTATION_ROADMAP.md`
- `11_DECISIONS.md`

## Documents

| File                           | Purpose                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `01_PRODUCT_REQUIREMENTS.md`   | Product goals, users, MVP scope, and requirements          |
| `02_USER_JOURNEY.md`           | End-to-end client and employee journey                     |
| `03_DOMAIN_AND_WORKFLOWS.md`   | Statuses, business rules, and workflow transitions         |
| `04_ARCHITECTURE.md`           | Application boundaries and data flow                       |
| `05_DATABASE_SCHEMA.md`        | Tables, fields, relationships, indexes, and RLS intent     |
| `06_AGENT_BEHAVIOR.md`         | Agent prompt contract, tools, escalation, and safety       |
| `07_API_CONTRACTS.md`          | HTTP endpoints and data contracts                          |
| `08_SECURITY_AND_PRIVACY.md`   | Tenant isolation, authorization, secrets, files, and logs  |
| `09_TESTING_AND_ACCEPTANCE.md` | Test strategy and end-to-end acceptance scenarios          |
| `10_IMPLEMENTATION_ROADMAP.md` | Ordered delivery milestones                                |
| `11_DECISIONS.md`              | Architecture decision log                                  |
| `12_GLOSSARY.md`               | Shared product and technical language                      |
| `13_CODEX_TASK_PROMPTS.md`     | Focused prompts for assigning implementation work to Codex |
| `12_MVP_ACCEPTANCE_MATRIX.md`  | Evidence-based MVP and pilot release gates                 |
| `KNOWN_LIMITATIONS.md`         | Honest pilot constraints and external dependencies         |
| `operations/`                  | Deployment, recovery, privacy, training, and support       |
| `plans/`                       | Living execution plans for complex features                |

## Documentation precedence

When documents conflict, use this order:

1. `AGENTS.md` for repository working rules and safety constraints
2. `01_PRODUCT_REQUIREMENTS.md` for product scope
3. `03_DOMAIN_AND_WORKFLOWS.md` for workflow behavior
4. `08_SECURITY_AND_PRIVACY.md` for security constraints
5. `11_DECISIONS.md` for recorded technical decisions
6. Other documents

Do not silently resolve a material contradiction. Update the documents and record the decision.

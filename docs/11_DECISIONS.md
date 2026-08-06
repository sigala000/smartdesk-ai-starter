# Architecture Decision Log

Record durable decisions here. Do not rewrite history; mark replaced decisions as superseded.

## ADR-001: Start with one construction tenant

Status: Accepted

Decision:

Build and test the first complete workflow using BuildPro Cameroon.

Reason:

A concrete tenant prevents vague generic behavior while the schema still includes organization boundaries for future clients.

Consequence:

Construction examples are seed configuration, not hard-coded global business rules.

## ADR-002: Multi-tenant data model from the beginning

Status: Accepted

Decision:

Tenant-owned data includes `organization_id`, with RLS and server-side authorization.

Reason:

The product is intended to be sold to multiple companies. Retrofitting isolation later is risky.

Consequence:

Every repository and test must consider organization scope.

## ADR-003: Web chat before production WhatsApp

Status: Accepted

Decision:

Validate the product through web chat first.

Reason:

It reduces integration complexity and allows the request workflow, dashboard, and AI behavior to be tested independently.

Consequence:

Channel abstractions should permit WhatsApp later, but production WhatsApp code is out of MVP scope.

## ADR-004: Modular monolith

Status: Accepted

Decision:

Use one Next.js application with clear internal modules.

Reason:

It is simpler to build, deploy, debug, and sell during the MVP stage.

Consequence:

Avoid premature microservices. Maintain boundaries in code so modules can be extracted later if justified.

## ADR-005: Supabase as system of record

Status: Accepted

Decision:

Use Supabase PostgreSQL, Auth, and Storage.

Reason:

It provides the required foundations with a manageable operational burden.

Consequence:

Database migrations and RLS policies are first-class code artifacts.

## ADR-006: OpenAI Responses API with controlled tools

Status: Accepted

Decision:

Use the Responses API for agent interaction and expose a small set of server-executed tools.

Reason:

The model can guide conversation while business state changes remain deterministic and validated.

Consequence:

No arbitrary database or code-execution tool is exposed to the customer-facing model.

## ADR-007: Core request flow works without AI

Status: Accepted

Decision:

Implement a deterministic structured request path before adding the model.

Reason:

The company must still capture requests when the AI provider is unavailable, and business correctness must not depend on language-model behavior.

Consequence:

The AI layer uses the same application services as non-AI routes.

## ADR-008: Human approval for prices and quotations

Status: Accepted

Decision:

The assistant may collect requirements and summarize them but cannot approve or invent prices.

Reason:

Construction pricing requires authorized business and technical judgment.

Consequence:

`quotation_sent` requires an authorized employee action and approved document.

## ADR-009: Private attachments

Status: Accepted

Decision:

All customer and quotation files are stored privately and accessed through short-lived signed mechanisms.

Reason:

Files may contain personal and commercially sensitive information.

Consequence:

Permanent public URLs are prohibited.

## ADR-010: Request reference is not authentication

Status: Accepted

Decision:

Status lookup requires the reference plus a verified second factor.

Reason:

Human-readable references can be shared or guessed.

Consequence:

Public status APIs require a challenge flow and return only customer-safe fields.

## ADR template

```markdown
## ADR-XXX: Title

Status: Proposed | Accepted | Superseded | Rejected

Decision:

Reason:

Alternatives considered:

Consequences:

Superseded by:
```

# Domain and Workflows

## Core entities

- Organization
- Organization member
- Department
- Service
- Customer
- Conversation
- Message
- Request
- Request field or structured details
- Attachment
- Assignment
- Status history
- Internal note
- Human handoff
- Knowledge document
- Notification
- Feedback

## Request types

Initial request types:

- `quotation`
- `site_visit`
- `service_question`
- `complaint`
- `support`
- `other`

A service question may remain a conversation without becoming a request. Complaints and human handoffs should create trackable records.

## Request statuses

Canonical status values:

- `draft`
- `new`
- `awaiting_customer_information`
- `awaiting_assessment`
- `site_visit_proposed`
- `site_visit_scheduled`
- `assessment_completed`
- `quotation_preparing`
- `quotation_sent`
- `quotation_revision_requested`
- `quotation_accepted`
- `quotation_rejected`
- `scheduled`
- `in_progress`
- `awaiting_client_validation`
- `completed`
- `cancelled`
- `unsupported`
- `inactive`
- `closed`

Display labels may be localized. Database values remain stable.

## Primary quotation workflow

```text
draft
  -> new
  -> awaiting_assessment
  -> site_visit_proposed
  -> site_visit_scheduled
  -> assessment_completed
  -> quotation_preparing
  -> quotation_sent
  -> quotation_accepted
  -> scheduled
  -> in_progress
  -> awaiting_client_validation
  -> completed
  -> closed
```

Optional branches:

```text
new -> awaiting_customer_information -> new
quotation_sent -> quotation_revision_requested -> quotation_preparing
quotation_sent -> quotation_rejected -> closed
any non-terminal status -> cancelled
new or awaiting_assessment -> unsupported -> closed
awaiting_customer_information -> inactive
inactive -> new
awaiting_client_validation -> in_progress
```

## Transition rules

- `draft -> new` requires all mandatory fields and customer confirmation.
- `new -> awaiting_assessment` requires employee review or configured auto-routing.
- Site-visit statuses require date and responsible employee where applicable.
- `quotation_sent` requires an approved quotation attachment and authorized actor.
- `quotation_accepted` requires a recorded customer acceptance or authorized employee confirmation with provenance.
- `in_progress` requires project authorization outside the AI.
- `completed` requires employee completion and client confirmation, or an explicit administrative override with reason.
- `closed` is terminal for normal operations, but administrators may reopen through an audited action.
- Every transition records actor, timestamp, previous status, new status, reason, and source.

## Draft request fields

Required:

- Customer full name
- Confirmed contact number
- Service ID
- Project description
- Project location
- Customer confirmation timestamp

Optional:

- Email
- Preferred contact method
- Preferred start date
- Budget range
- Additional structured service fields
- Attachments

## Service-specific fields

Services may define JSON-schema-like field configurations.

Example for renovation:

- Areas to renovate
- Property type
- Occupied during work
- Approximate size
- Existing plans available

The first version should support configuration without building a fully generic no-code form engine.

## Routing rules

Default:

- Quotation and site-visit requests -> Commercial Department
- Technical assessment -> Technical Department
- Complaints and explicit human requests -> Customer Support

Routing must be deterministic in the backend. The model may recommend a route, but the backend validates it against active organization configuration.

## Assignment rules

- A request may have one current department.
- A request may have zero or one current primary employee.
- Assignment changes are audited.
- Deactivated employees cannot receive new assignments.
- Employees may see data according to role and department policies.

## Human handoff states

- `requested`
- `queued`
- `assigned`
- `active`
- `resolved`
- `cancelled`

A handoff includes:

- Reason
- Priority
- Conversation
- Request, when available
- Assigned employee
- Requested timestamp
- Resolution timestamp

## Escalation priority

- `normal`: explicit human request, unsupported question
- `high`: angry customer, repeated failures, payment dispute
- `urgent`: immediate safety risk, threat, suspected fraud, severe incident

The assistant must not claim emergency services have been contacted.

## Duplicate handling

Request creation accepts an idempotency key generated for the confirmed draft.

If the same key is retried:

- Return the existing request.
- Do not create a new request.
- Return the same reference.

Message ingestion should also deduplicate provider message IDs when external channels are added.

## Reference numbers

Reference numbers are generated server-side.

Recommended format:

```text
<tenant-prefix>-<year>-<zero-padded-sequence>
BP-2026-000041
```

Requirements:

- Unique within the platform
- Immutable
- Human readable
- Not used as the sole authorization factor
- Never generated by the language model

## Notifications

Customer notifications may be created for:

- Request created
- Additional information requested
- Assignment or assessment update
- Site visit proposed or confirmed
- Quotation available
- Quotation revision
- Work scheduled
- Work started
- Completion validation
- Closure

Notifications must be based on backend events, not unsupported model claims.

## Internal notes

- Never shown to customers.
- Must record author and timestamp.
- Must not be sent to the model unless needed and permitted.
- Sensitive notes should be minimized.

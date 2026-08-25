# Product Requirements

## Product name

SmartDesk AI

## First tenant

BuildPro Cameroon, a fictional construction company used to validate the product.

## Problem

Service companies receive enquiries through calls, WhatsApp, social media, and websites. Requests are frequently incomplete, lost, assigned late, or followed up inconsistently. Customers repeat themselves and have little visibility into progress. Managers cannot reliably see pending opportunities or response times.

## Product outcome

SmartDesk AI gives a company one structured workflow for receiving, clarifying, assigning, tracking, and closing customer requests while keeping humans responsible for important business decisions.

## Primary users

### Prospective client

A person or organization asking for information, requesting a quotation, or arranging a site visit.

### Existing client

A customer following an active request or reporting a problem.

### Commercial officer

An employee who reviews leads, requests missing information, assigns work, and sends approved quotations.

### Technical officer

An employee who assesses technical requirements and records site-visit findings.

### Project manager

An employee responsible for execution updates and completion.

### Organization administrator

An employee who manages users, departments, services, company information, and permissions.

## MVP goals

The MVP must:

1. Capture customer requests through web chat.
2. Answer questions from approved company information.
3. Collect required information one question at a time.
4. Produce a structured summary for customer confirmation.
5. Create a request only after confirmation.
6. Generate a unique reference number.
7. Route requests to the correct department.
8. Support employee review, assignment, and status updates.
9. Store attachments securely.
10. Support status lookup with identity verification.
11. Escalate conversations to a human.
12. Maintain an audit history.
13. Prevent data access across organizations.

## MVP customer capabilities

- Start a new conversation
- Choose a common action or type naturally
- Ask about services
- Request a quotation
- Request a site visit
- Provide identity and project details
- Upload supported files
- Correct information before submission
- Confirm or cancel submission
- Receive a reference number
- Check request status
- Respond to requests for more information
- Ask for a human

## MVP employee capabilities

- Sign in
- View only organization-authorized data
- Filter and search requests
- Open request details
- Read conversation summaries and customer messages
- View attachments
- Assign a department and employee
- Request missing information
- Change request status through valid transitions
- Add internal notes
- Upload an approved quotation
- Mark a request complete or cancelled
- View audit history

## BuildPro service catalogue

The seed tenant supports:

- Building construction
- House renovation
- Electrical installation
- Plumbing
- Painting
- Site inspection

## Initial departments

- Commercial Department
- Technical Department
- Customer Support

## Non-goals for MVP

The MVP will not:

- Calculate engineering quantities
- Generate a final price autonomously
- Approve discounts
- Sign contracts
- Process payments
- Promise project dates
- Replace an engineer or project manager
- Make autonomous safety, legal, or financial decisions
- Use multiple independent AI agents

Phase 10 expands the validated MVP with an application-side production
WhatsApp foundation: client-owned Meta assets connected through Embedded
Signup, encrypted tenant credentials, destination-based routing, and existing
confirmed request workflows. Meta approval, business/number verification,
billing, legal approval, and phone migration remain external manual gates.

## Functional requirements

### FR-01: Company welcome

The assistant displays the company identity, states that it is virtual, and offers common actions.

### FR-02: Natural-language intent

The system recognizes supported intents while allowing the customer to choose explicit menu actions.

Supported initial intents:

- Ask about services
- Request quotation
- Request site visit
- Check request status
- Report a problem
- Speak to a human

### FR-03: Guided collection

The assistant collects only information relevant to the chosen service and asks one focused question at a time.

### FR-04: Minimum request information

A new request cannot be submitted without:

- Customer name
- Confirmed contact number
- Service
- Description
- Location
- Customer confirmation

### FR-05: Confirmation

The assistant displays a clear summary and lets the customer confirm, edit, or cancel.

### FR-06: Reference number

The backend creates a non-guessable-enough, human-readable unique reference. The model must not invent it.

Recommended display pattern:

```text
BP-2026-000041
```

The database primary key remains a UUID.

### FR-07: Assignment

A new quotation request is initially routed to the Commercial Department unless a configured routing rule says otherwise.

### FR-08: Status updates

Employees may change status only through allowed transitions. Every change creates an audit record.

### FR-09: Human handoff

The customer can request a human at any point. The system also escalates based on defined safety and uncertainty rules.

### FR-10: Attachments

Customers and authorized employees may upload approved file types within configured size limits. Files are private by default.

### FR-11: Status lookup

The customer provides a request reference and verifies a contact factor before status is revealed.

### FR-12: Knowledge answers

The assistant answers only from active, approved organization content. When no grounded answer exists, it says so and offers human support.

## Non-functional requirements

### Reliability

- Duplicate submissions must be prevented or safely handled.
- Tool calls must be idempotent where practical.
- A failed AI request must not lose the user's saved conversation.
- Database operations must return explicit success or error results.

### Performance

- Non-AI API operations should normally complete within two seconds under pilot load.
- The chat interface should show a progress state while waiting.
- Large file processing must not block the main request flow.

### Accessibility

- Keyboard-accessible controls
- Clear labels and error messages
- Adequate contrast
- Mobile-responsive layout
- No reliance on color alone for status

### Localization

- Store canonical data separately from display text.
- Design strings for English and French, even if the first implementation is English-first.
- Store timestamps in UTC.

### Maintainability

- Separate UI, application services, repositories, and external integrations.
- Keep product rules in testable functions.
- Record architectural changes in `11_DECISIONS.md`.

## Success metrics for pilot

- At least 90% of test quotation requests are captured with all required fields.
- No cross-tenant data exposure in security tests.
- A customer can complete a normal request without employee intervention.
- Employees can find and process a new request from the dashboard.
- Unsupported or uncertain enquiries are escalated instead of fabricated.
- Duplicate retries do not create multiple requests.

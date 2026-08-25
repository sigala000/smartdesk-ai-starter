# End-to-End User Journey

## Journey title

Client requests a construction service and follows the request to closure.

## Primary user story

As a client, I want to contact BuildPro Cameroon, explain what I need, provide the required project information, receive a reference number, follow progress, communicate with the company, and confirm completion so that I do not have to repeatedly call or visit the office.

## Preconditions

- BuildPro Cameroon is active in the platform.
- Its services, departments, users, and approved knowledge are configured.
- The public web chat is available.
- At least one employee can receive escalations and assignments.

## Main success journey

### 1. Customer opens chat

The assistant greets the customer and says it is a virtual assistant.

It offers:

1. Request a quotation
2. Request a site visit
3. Ask about services
4. Check an existing request
5. Report a problem
6. Speak with an employee

The customer may also type naturally.

### 2. Intent is identified

Example customer message:

> I want to renovate my kitchen and bathroom.

The system identifies:

- Intent: quotation request
- Likely service: house renovation
- Default department: Commercial Department

When confidence is low, the assistant asks a clarifying question rather than guessing.

### 3. Customer identity is collected

The assistant asks for:

- Full name
- Contact number
- Email, optional
- Preferred contact method, optional

When the channel already provides a phone number, the assistant asks the customer to confirm it rather than assuming ownership.

### 4. Project details are collected

The assistant asks one focused question at a time:

- Which service is needed?
- Where is the project located?
- What work should be performed?
- When would the customer prefer work to begin?
- Is there an estimated budget?
- Are pictures, plans, or documents available?

Required fields are collected before optional fields.

### 5. Attachments are added

The customer may upload photographs or documents.

The system:

- Validates type and size
- Stores the file privately
- Creates attachment metadata
- Associates the file with the draft conversation or request
- Shows success or failure to the customer

### 6. Missing information is requested

Before submission, the system checks minimum requirements.

Example:

> Please provide the project location before I submit your request.

The request remains a draft until complete and confirmed.

### 7. Summary is shown

Example:

```text
Name: John Mbah
Service: House renovation
Work: Kitchen and bathroom renovation
Location: Odza, Yaoundé
Preferred start: September 2026
Budget: Not specified
Attachments: 4
```

The customer can:

- Confirm
- Edit a field
- Cancel

### 8. Request is created

Only after confirmation, the backend:

1. Validates the draft.
2. Creates the customer if necessary.
3. Creates the request.
4. Generates a reference.
5. Sets the initial status.
6. Assigns the default department.
7. Links attachments and conversation.
8. Writes audit events.

The assistant displays the reference returned by the backend.

### 9. Employee receives request

The request appears in the organization dashboard with:

- Reference
- Customer
- Service
- Description
- Location
- Attachments
- Date received
- Status
- Department
- Assignment state
- Conversation summary

### 10. Commercial review

A commercial officer may:

- Accept for assessment
- Request more information
- Assign a technical officer
- Schedule a site visit
- Mark unsupported
- Escalate internally
- Contact the customer

### 11. More information, when needed

The employee asks a structured follow-up question.

The customer receives it in the conversation. Their answer is added to the same request and the employee is notified.

### 12. Technical assessment

The request is assigned to the Technical Department.

When a site visit is needed, the company proposes available times. The customer chooses one, and both sides receive confirmation.

The employee records observations after the visit.

### 13. Quotation preparation

An authorized employee prepares and uploads the approved quotation.

The AI may help summarize requirements, but it must not invent or approve prices.

The client receives a notification that the quotation is available.

### 14. Client decision

The client may:

- Accept
- Reject
- Ask a question
- Request revision
- Ask for a human

The system records the action and updates the status through a valid transition.

### 15. Work execution

After commercial steps outside or inside the future system are complete, an employee marks the work scheduled and later in progress.

The client receives milestone updates entered or approved by employees.

### 16. Issue reporting

The client may report an issue under the active request.

The assistant collects a short description and urgency, creates an issue record or escalation, and confirms that it was forwarded.

Safety complaints, threats, payment disputes, or serious dissatisfaction go directly to a human.

### 17. Completion

The project manager marks work as awaiting client validation.

The client can:

- Confirm completion
- Report unfinished work
- Report a defect
- Request inspection

### 18. Feedback and closure

After confirmation, the customer can give a score and comment.

The request is closed while retaining its audit history.

## Alternative journeys

### Unsupported service

The assistant explains that the service is not listed and offers human support. It does not claim that the company can perform the work.

### Customer abandons the draft

The draft is retained according to retention policy. A reminder may be sent only when the customer has consented to follow-up.

### Customer does not answer a company question

The request remains `awaiting_customer_information`. After a configured period, an employee may mark it inactive. A later reply may reopen it.

### Customer cancels

The system requests confirmation, records a reason when provided, changes status to cancelled, and writes an audit event.

### Customer asks for a human

The system immediately creates a handoff record. The assistant confirms the handoff and does not pretend that a human has joined until an employee actually takes control.

### AI service is unavailable

The chat preserves the user message, displays a neutral error, and offers a structured form or human contact path. No request is silently discarded.

## Employee journey

1. Employee signs in.
2. Authorization resolves organization and role.
3. Dashboard lists only permitted organization requests.
4. Employee filters or opens a request.
5. Employee sees customer-visible data and role-authorized internal data.
6. Employee assigns, requests information, uploads approved documents, or changes status.
7. System validates the transition.
8. System writes an audit record.
9. Customer receives an approved notification when appropriate.
10. Employee closes the request after completion or cancellation.

# Phase 10 company onboarding journey

1. A company owner creates an account and confirms the email according to the
   configured Supabase Auth policy.
2. The owner creates one isolated onboarding workspace and becomes its first
   administrator.
3. The administrator adds departments/services, invites employees, and activates
   the workspace only after the minimum catalogue exists.
4. The administrator selects **Connect WhatsApp with Meta**. Meta—not SmartDesk—
   collects Meta login, asset selection, terms, phone OTP/registration, and
   client billing steps.
5. SmartDesk exchanges the returned code server-side, validates the selected
   assets, subscribes the WABA, encrypts the tenant credential, and shows only
   connection/health metadata.
6. Customers message the company's number. The signed destination resolves the
   tenant and the same SmartDesk agent/request confirmation journey runs.
7. Meta bills the client directly. SmartDesk's own trial/subscription state is
   separate and contains no payment-card data.

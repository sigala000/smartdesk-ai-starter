# Security and Privacy

## Security goals

- Prevent cross-tenant data access.
- Protect customer contact and project information.
- Keep secrets server-side.
- Prevent unauthorized employee actions.
- Treat model and user content as untrusted.
- Preserve a reliable audit trail.
- Minimize collected and logged data.

## Tenant isolation

Every tenant-owned record includes `organization_id`.

Rules:

- Organization scope comes from authenticated membership or trusted public tenant configuration.
- Never accept an employee action's organization scope solely from request JSON.
- Repository methods require organization scope.
- Supabase RLS enforces same-organization access.
- Service-role queries still include explicit organization filters.
- Attachment paths begin with a server-resolved tenant segment.
- Knowledge retrieval is tenant-filtered before content reaches the model.

Test cross-tenant access intentionally.

## Authentication

### Employees

Use Supabase Auth.

Requirements:

- Verified login method
- Secure session handling
- Active organization membership
- Role authorization on every server action
- Deactivated members lose access
- Sensitive actions may require recent authentication later

### Customers

Public chat does not require a full account in the MVP.

Use:

- Opaque conversation access token
- Rate limiting
- Request-status verification challenge
- Short-lived status token
- Reference number plus a second factor

A reference number alone is not authentication.

## Authorization

Authorization belongs in server-side application services.

Example permission concepts:

- View organization requests
- View department requests
- Assign requests
- Change status
- Upload quotation
- Manage members
- Manage knowledge
- View reports

Do not rely only on hidden buttons.

## Secrets

Never expose:

- `OPENAI_API_KEY`
- Supabase service-role key
- Webhook secrets
- Signing keys
- Provider access tokens

Rules:

- Store in environment secret management.
- Do not commit `.env` files.
- Redact secrets from logs and errors.
- Rotate compromised secrets.
- Use separate keys for development, staging, and production.

## Input validation

Validate:

- IDs
- Organization slug
- Phone number
- Email
- Message length
- Field names
- Enum values
- Dates
- Numeric budget values
- File metadata
- Tool arguments
- Pagination

Apply reasonable maximum lengths.

The model cannot authorize invalid input.

## Prompt injection

Customer text and documents can contain malicious instructions.

Controls:

- Stable server-owned system instructions
- Minimal tools
- Backend authorization for every tool
- No arbitrary SQL, shell, URL fetch, or filesystem tool
- Tenant-scoped retrieval
- Structured tool arguments
- Output filtering for internal data
- Regression tests for common injection attacks

## File security

Initial allowed types may include:

- JPEG
- PNG
- PDF

Controls:

- File size limit
- MIME allowlist
- Extension and content consistency checks where available
- Private storage bucket
- Randomized storage path
- Signed short-lived download URLs
- Authorization before signing
- Malware scanning when moving beyond pilot
- No public bucket for customer documents
- No direct use of original filename as storage path

Do not automatically send every uploaded file to the model.

Phase 6 applies a 10 MiB pilot limit and accepts exactly `image/jpeg`,
`image/png`, and `application/pdf`. Completion compares the stored size and MIME
metadata and inspects JPEG/PNG/PDF magic bytes before activation. Pilot files are
recorded as `not_scanned`; this must not be represented to users as antivirus
scanning. Anonymous or authenticated clients receive no broad Storage object
policy, and each download requires server authorization before a 60-second URL
is signed.

## Data minimization

Collect only information needed for service delivery.

Avoid requesting:

- Government identification unless a defined later process requires it
- Payment card information
- Passwords
- Medical information
- Unnecessary personal details

When a customer sends unnecessary sensitive data, avoid repeating it and offer human guidance.

## Logging

Log:

- Trace ID
- Organization ID
- User or conversation pseudonymous ID
- Action
- Outcome
- Error code
- Duration
- Model and tool metadata as needed

Do not log by default:

- Full phone numbers
- Full message bodies
- File contents
- Secrets
- Authentication tokens
- Internal prompt text in public analytics

Use redaction.

## Audit trail

Audit:

- Request creation
- Assignment
- Status transition
- Quotation upload
- Human handoff
- Administrative changes
- Knowledge approval
- Request reopen or override

Audit records should be append-only for normal users.

## Rate limiting and abuse

Apply limits to:

- Conversation creation
- Message sending
- Status challenge requests
- Verification attempts
- File uploads
- Expensive AI calls

Use escalating temporary blocks for repeated verification failures.

## OpenAI data boundary

Send only data needed for the current turn.

Prefer:

- Structured request summary
- Recent relevant messages
- Approved knowledge excerpts
- Opaque internal IDs when possible

Avoid sending:

- Unrelated customer records
- Internal notes
- Entire tenant database
- Long-term secrets
- Employee credentials

## Retention

Define before production:

- Conversation retention
- Closed request retention
- Attachment retention
- Log retention
- Verification challenge retention
- Deleted-user handling

The pilot may use documented defaults, but production clients must receive a clear retention policy.

## Backups and recovery

Before real customer deployment:

- Enable database backups.
- Test restoration.
- Document recovery objectives.
- Separate environments.
- Protect migration access.
- Verify that storage files and database metadata are recoverable.

## Security acceptance conditions

- RLS tests prevent cross-tenant reads and writes.
- Public clients cannot list requests.
- Reference-only status access fails.
- Invalid tool arguments are rejected.
- Prompt injection cannot expose prompts or other tenant data.
- Unauthorized roles cannot upload quotations or change protected statuses.
- Signed file URLs expire.
- Secrets are absent from client bundles and repository history.

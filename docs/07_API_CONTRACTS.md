# API Contracts

## General conventions

- Base path: `/api`
- JSON requests and responses unless uploading files
- Validate every input
- Return a trace ID
- Never return stack traces
- Use standard HTTP status codes
- Require idempotency for request creation
- Resolve organization from trusted context

## Error shape

```json
{
  "error": {
    "code": "validation_error",
    "message": "A customer-safe explanation.",
    "fieldErrors": {
      "location": ["Location is required."]
    },
    "traceId": "trace_uuid"
  }
}
```

Internal logs may contain more detail, but responses must remain sanitized.

## Public chat endpoints

### POST /api/conversations

Creates a public web conversation for an active organization.

Request:

```json
{
  "organizationSlug": "buildpro-cameroon",
  "locale": "en"
}
```

Response `201`:

```json
{
  "conversation": {
    "id": "uuid",
    "organizationName": "BuildPro Cameroon",
    "state": "open",
    "createdAt": "ISO-8601"
  }
}
```

Security:

- Rate limit by IP and browser/session identifiers.
- Do not accept raw `organization_id` from public clients when a slug can be resolved.

### POST /api/conversations/{conversationId}/messages

Saves a customer message and returns the assistant response.

Request:

```json
{
  "message": "I want to renovate my kitchen.",
  "clientMessageId": "uuid"
}
```

The implemented Phase 5 natural-language variant is:

```json
{
  "clientMessageId": "uuid",
  "kind": "message",
  "message": "I want to renovate my kitchen."
}
```

The server resolves organization and conversation scope from the opaque conversation cookie. Model output and tool arguments cannot supply that scope. When AI is disabled or unavailable, the message is retained and the deterministic Phase 4 prompt is returned.

Response `200`:

```json
{
  "customerMessage": {
    "id": "uuid",
    "createdAt": "ISO-8601"
  },
  "assistantMessage": {
    "id": "uuid",
    "content": "Which town and neighbourhood is the property located in?",
    "createdAt": "ISO-8601"
  },
  "conversation": {
    "state": "open",
    "intent": "quotation_request"
  },
  "actions": []
}
```

Requirements:

- Deduplicate `clientMessageId`.
- Persist customer input before calling OpenAI.
- On AI failure, preserve the input and return a recoverable response.

### GET /api/conversations/{conversationId}

Returns a customer-safe conversation view using a signed public conversation token.

Do not expose internal messages, tool metadata, or notes.

### POST /api/conversations/{conversationId}/confirm-request

Confirms the current structured draft.

Request:

```json
{
  "confirmation": true,
  "confirmationNonce": "opaque_value",
  "idempotencyKey": "uuid"
}
```

Response `201`:

```json
{
  "request": {
    "id": "uuid",
    "referenceNumber": "BP-2026-000041",
    "displayStatus": "Awaiting assessment",
    "createdAt": "ISO-8601"
  }
}
```

The server must not trust request fields supplied again by the browser at confirmation. It uses confirmed server-stored draft values.

### POST /api/request-status/challenge

Begins customer verification.

Request:

```json
{
  "organizationSlug": "buildpro-cameroon",
  "referenceNumber": "BP-2026-000041",
  "phone": "+2376XXXXXXXX"
}
```

Response:

```json
{
  "challengeId": "uuid",
  "deliveryHint": "SMS ending in 42",
  "expiresAt": "ISO-8601"
}
```

For early local development, a non-production mock verification flow may be used. It must be clearly isolated from production.

Unknown references and mismatched phone factors receive the same accepted
challenge shape as a match. An explicitly enabled local mock may additionally
return `developmentCode` for a real matching challenge; production rejects mock
mode and code exposure.

### POST /api/request-status/verify

Request:

```json
{
  "challengeId": "uuid",
  "code": "123456"
}
```

Response:

```json
{
  "verificationToken": "short_lived_token",
  "expiresAt": "ISO-8601"
}
```

### GET /api/request-status/{referenceNumber}

Requires the short-lived verification token.

Supply it as `Authorization: Bearer <token>`, never in the URL. It is bound to
the exact request and expires without sliding renewal.

Response:

```json
{
  "request": {
    "referenceNumber": "BP-2026-000041",
    "serviceName": "House renovation",
    "displayStatus": "Awaiting assessment",
    "lastUpdate": "Your request is under technical review.",
    "nextAction": "The company will contact you if more information is required.",
    "updatedAt": "ISO-8601"
  }
}
```

## Attachment endpoints

### POST /api/attachments/presign

Returns a controlled upload instruction.

Request:

```json
{
  "target": {
    "kind": "conversation",
    "conversationId": "uuid"
  },
  "clientUploadId": "uuid",
  "filename": "kitchen.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 1400000
}
```

Response:

```json
{
  "attachment": {
    "id": "uuid",
    "filename": "kitchen.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 1400000
  },
  "path": "server-generated randomized path",
  "token": "opaque signed-upload token",
  "expiresAt": "ISO-8601"
}
```

The exact Supabase upload mechanism may differ. Do not return service credentials.

### POST /api/attachments/{attachmentId}/complete

Confirms upload and performs post-upload validation.

The completion body cannot replace tenant, target, filename, MIME, size, or
path metadata. Those values are reloaded from server-owned pending state.

Response:

```json
{
  "attachment": {
    "id": "uuid",
    "filename": "kitchen.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 1400000
  }
}
```

### POST /api/attachments/{attachmentId}/download

Reauthorizes the current customer conversation or employee request access and
returns an exact-object signed URL valid for 60 seconds. No permanent public URL
is returned and the response is not cacheable.

### DELETE /api/attachments/{attachmentId}

Invalidates an authorized attachment before retry-safe object deletion.

## Employee endpoints

All employee endpoints require an authenticated active organization member.

### GET /api/dashboard/requests

Query parameters:

- `status`
- `departmentId`
- `assignedMemberId`
- `serviceId`
- `search`
- `cursor`
- `limit`

Response:

```json
{
  "items": [],
  "nextCursor": null
}
```

The server always applies organization scope.

### GET /api/dashboard/requests/{requestId}

Returns:

- Request
- Customer-safe conversation
- Attachments
- Current assignment
- Status history
- Internal notes according to role
- Human handoff state

### PATCH /api/dashboard/requests/{requestId}/assignment

Request:

```json
{
  "departmentId": "uuid",
  "memberId": "uuid",
  "reason": "Technical assessment required."
}
```

Validate that the department and member belong to the same organization and are active.

### POST /api/dashboard/requests/{requestId}/status-transitions

Request:

```json
{
  "newStatus": "awaiting_assessment",
  "reason": "Initial review completed."
}
```

Response:

```json
{
  "request": {
    "id": "uuid",
    "status": "awaiting_assessment",
    "updatedAt": "ISO-8601"
  }
}
```

Reject invalid transitions with `409 conflict`.

### POST /api/dashboard/requests/{requestId}/notes

Request:

```json
{
  "content": "Customer prefers afternoon visits."
}
```

Notes are employee-only.

### POST /api/dashboard/requests/{requestId}/request-information

Request:

```json
{
  "question": "What is the approximate kitchen size?"
}
```

The service:

- Saves the employee question.
- Changes status if appropriate.
- Creates a customer notification.
- Audits the action.

### POST /api/dashboard/requests/{requestId}/quotation

Uploads or associates an approved quotation.

Requirements:

- Authorized roles only
- Approved file type
- Audit record
- Status transition validation
- No AI-generated amount is treated as approved

## WhatsApp developer-test webhook

### GET /api/webhooks/whatsapp

Performs Meta's verification challenge. It returns the plain challenge only
when `hub.mode=subscribe` and the bounded verify token matches server
configuration. The token is never logged or returned on failure.

### POST /api/webhooks/whatsapp

This remains outside production MVP scope and supports only Meta's developer
test number plus the configured authorized test recipient.

- Requires `X-Hub-Signature-256` HMAC validation over the exact raw body.
- Stops streaming request bodies as soon as the configured byte limit is exceeded.
- Accepts bounded WhatsApp Business Account `messages` envelopes and text turns.
- Deduplicates `(trusted account, provider message ID)` before model spend.
- Resolves organization from the configured destination phone-number ID.
- Persists inbound canonical messages before invoking the shared Phase 5 agent.
- Persists assistant replies/outbox state before the server-only Meta send.
- Applies tenant-account, sender, and agent-turn limits after authentication and
  durable ingestion.
- Returns `5xx` while an inbound lease or explicitly retryable Meta send needs a
  provider retry. Ambiguous outbound outcomes are retained for review and are
  never blindly resent.
- Returns sanitized plain responses and an internal trace ID only in redacted logs.

It does not accept tenant IDs, access tokens, request fields, or references from
the webhook body. Unsupported media never reaches OpenAI.

## Internal service contracts

Application services should return discriminated results.

Example:

```ts
type CreateRequestResult =
  | {
      ok: true;
      requestId: string;
      referenceNumber: string;
      status: string;
    }
  | {
      ok: false;
      code:
        | "draft_incomplete"
        | "confirmation_required"
        | "invalid_service"
        | "duplicate"
        | "internal_error";
      message: string;
    };
```

Do not use exceptions for expected business outcomes.

## Phase 7 handoff endpoints

- `POST /api/conversations/:conversationId/handoffs` requests idempotent human
  support using the existing opaque conversation cookie.
- `GET /api/dashboard/handoffs` lists the authorized employee queue.
- `GET /api/dashboard/handoffs/:handoffId` returns an authorized detail view.
- `POST .../assignment`, `POST .../join`, `POST .../messages`, and
  `POST .../resolve` perform closed, audited lifecycle transitions.

Assignment never implies human presence. A successful join response with
status `active` is the only evidence that customer-facing UI may use to claim
an employee joined. Resolve bodies require an explicit `resumeAutomation`
boolean.

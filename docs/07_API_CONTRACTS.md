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
  "conversationId": "uuid",
  "filename": "kitchen.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 1400000
}
```

Response:

```json
{
  "attachmentId": "uuid",
  "upload": {
    "method": "signed-upload",
    "token": "opaque_value",
    "storagePath": "tenant/..."
  }
}
```

The exact Supabase upload mechanism may differ. Do not return service credentials.

### POST /api/attachments/{attachmentId}/complete

Confirms upload and performs post-upload validation.

Response:

```json
{
  "attachment": {
    "id": "uuid",
    "filename": "kitchen.jpg",
    "status": "active"
  }
}
```

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

## Webhook endpoint placeholder

### POST /api/webhooks/whatsapp

Out of MVP production scope.

When implemented:

- Verify provider signature.
- Deduplicate provider message ID.
- Resolve organization from configured phone number.
- Persist raw minimal metadata securely.
- Process asynchronously where appropriate.
- Never trust tenant identifiers inside message text.

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

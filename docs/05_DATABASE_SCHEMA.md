# Database Schema

## General conventions

- Use UUID primary keys.
- Include `organization_id` on tenant-owned tables.
- Use `timestamptz`.
- Store timestamps in UTC.
- Use `created_at` and `updated_at` where appropriate.
- Use soft deletion only where product or compliance needs it.
- Enforce integrity with foreign keys and constraints.
- Add Row Level Security to exposed tables.
- Never rely on UI filtering for tenant isolation.

## Tables

### organizations

Purpose: tenant/company record.

Fields:

- `id uuid primary key`
- `name text not null`
- `slug text unique not null`
- `reference_prefix text unique not null`
- `industry text`
- `email text`
- `phone text`
- `address text`
- `timezone text not null default 'Africa/Douala'`
- `default_language text not null default 'en'`
- `is_active boolean not null default true`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

### organization_members

Purpose: link authenticated users to organizations.

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `user_id uuid not null`
- `full_name text not null`
- `role text not null`
- `department_id uuid null`
- `is_active boolean not null default true`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `(organization_id, user_id)`

Initial roles:

- `admin`
- `manager`
- `commercial_officer`
- `technical_officer`
- `project_manager`
- `support_officer`
- `viewer`

### departments

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `name text not null`
- `description text`
- `is_active boolean not null default true`
- `created_at timestamptz not null`

Unique:

- `(organization_id, name)`

### services

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `department_id uuid null`
- `code text not null`
- `name text not null`
- `description text`
- `required_fields jsonb not null default '[]'`
- `is_active boolean not null default true`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `(organization_id, code)`

### customers

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `full_name text not null`
- `phone_e164 text not null`
- `email text null`
- `preferred_contact_method text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Recommended uniqueness:

- `(organization_id, phone_e164)`

Do not assume phone numbers can never be shared. The application should support an administrative merge or exception later.

### conversations

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `customer_id uuid null`
- `request_id uuid null`
- `channel text not null`
- `external_conversation_id text null`
- `state text not null default 'open'`
- `current_intent text null`
- `collected_fields jsonb not null default '{}'`
- `confirmed_fields jsonb not null default '{}'`
- `summary text null`
- `assigned_member_id uuid null`
- `last_message_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Channel values initially:

- `web`

Future:

- `whatsapp`

State values:

- `open`
- `awaiting_customer`
- `human_handoff`
- `resolved`
- `closed`

### messages

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `conversation_id uuid not null`
- `sender_type text not null`
- `sender_member_id uuid null`
- `content text not null`
- `provider_message_id text null`
- `model_name text null`
- `metadata jsonb not null default '{}'`
- `created_at timestamptz not null`

Sender types:

- `customer`
- `assistant`
- `employee`
- `system`
- `tool`

Index:

- `(conversation_id, created_at)`

Unique when present:

- `(organization_id, provider_message_id)`

### requests

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `customer_id uuid not null`
- `conversation_id uuid null`
- `service_id uuid not null`
- `department_id uuid null`
- `assigned_member_id uuid null`
- `reference_number text not null`
- `request_type text not null`
- `title text not null`
- `description text not null`
- `location_text text not null`
- `preferred_start_date date null`
- `budget_min numeric null`
- `budget_max numeric null`
- `budget_currency text null default 'XAF'`
- `priority text not null default 'normal'`
- `status text not null`
- `structured_details jsonb not null default '{}'`
- `customer_confirmed_at timestamptz not null`
- `closed_at timestamptz null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Unique:

- `reference_number`
- `(organization_id, idempotency_key)` when an `idempotency_key` column is implemented

Indexes:

- `(organization_id, status, created_at desc)`
- `(organization_id, department_id, status)`
- `(organization_id, assigned_member_id, status)`
- `(organization_id, customer_id, created_at desc)`

### request_status_history

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `request_id uuid not null`
- `previous_status text null`
- `new_status text not null`
- `changed_by_type text not null`
- `changed_by_member_id uuid null`
- `reason text null`
- `source text not null`
- `created_at timestamptz not null`

This table is append-only for normal application roles.

### assignments

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `request_id uuid not null`
- `department_id uuid null`
- `member_id uuid null`
- `assigned_by_member_id uuid null`
- `reason text null`
- `started_at timestamptz not null`
- `ended_at timestamptz null`

### attachments

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `request_id uuid null`
- `conversation_id uuid null`
- `uploaded_by_type text not null`
- `uploaded_by_member_id uuid null`
- `storage_bucket text not null`
- `storage_path text not null`
- `original_filename text not null`
- `mime_type text not null`
- `size_bytes bigint not null`
- `status text not null default 'active'`
- `created_at timestamptz not null`

The database stores paths, not public permanent URLs.

### internal_notes

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `request_id uuid not null`
- `author_member_id uuid not null`
- `content text not null`
- `created_at timestamptz not null`
- `updated_at timestamptz null`

### human_handoffs

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `conversation_id uuid not null`
- `request_id uuid null`
- `reason text not null`
- `priority text not null`
- `status text not null`
- `assigned_member_id uuid null`
- `requested_at timestamptz not null`
- `accepted_at timestamptz null`
- `resolved_at timestamptz null`

### knowledge_documents

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `title text not null`
- `source_type text not null`
- `storage_path text null`
- `content_text text null`
- `external_vector_file_id text null`
- `version integer not null default 1`
- `approval_status text not null`
- `approved_by_member_id uuid null`
- `approved_at timestamptz null`
- `is_active boolean not null default false`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Only approved and active content is eligible for customer answers.

### notifications

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `customer_id uuid null`
- `member_id uuid null`
- `request_id uuid null`
- `channel text not null`
- `template_code text not null`
- `payload jsonb not null`
- `status text not null`
- `scheduled_at timestamptz null`
- `sent_at timestamptz null`
- `error_message text null`
- `created_at timestamptz not null`

### feedback

Fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `request_id uuid not null`
- `customer_id uuid not null`
- `rating smallint not null`
- `comment text null`
- `created_at timestamptz not null`

Constraint:

- `rating between 1 and 5`

## Reference sequence

Use a database function or transaction-safe sequence to generate the numeric component of references per organization.

Do not calculate the next number with:

```text
SELECT MAX(...) + 1
```

because concurrent requests can generate duplicates.

## Row Level Security intent

### Employee access

An authenticated user may access tenant-owned rows only when:

- An active `organization_members` row links the user to the same organization.
- Their role permits the action.
- Department restrictions are satisfied when applicable.

### Public customer access

Public chat should not receive broad direct table access.

Use server endpoints or narrowly scoped database functions for:

- Creating conversations
- Sending messages
- Uploading to controlled paths
- Checking a request after verification

### Service role

Use only in server-side code. It bypasses RLS and therefore every query must explicitly scope `organization_id`.

## Transactions

Use a transaction for request creation:

1. Validate idempotency.
2. Create or resolve customer.
3. Generate reference.
4. Insert request.
5. Link conversation.
6. Link attachments.
7. Insert status history.
8. Insert assignment.
9. Return request.

Use a transaction for status changes and assignment changes.

## Seed data

Create:

- BuildPro Cameroon organization
- Three departments
- Six services
- One administrator
- Representative workflow configuration
- Approved FAQ entries
- Test customers and requests only in development

## Phase 10 tenant and provider tables

- `organizations.lifecycle_status` separates onboarding, active, suspended, and
  closed tenant state.
- `organization_subscriptions` stores provider-independent trial/subscription
  state and feature entitlements, never a payment instrument.
- `whatsapp_accounts` stores tenant-visible Meta assets, mode, connection health,
  quality, and billing-readiness metadata.
- `whatsapp_credential_envelopes` stores authenticated ciphertext, IV, tag, and
  key version and has no anonymous/authenticated access.
- `whatsapp_developer_test_recipients` is the explicit Meta test allowlist.
- `meta_embedded_signup_attempts` stores digest-only, expiring, one-use state.
- `organization_invitations` stores digest-only invitation tokens and role scope.

Every new tenant table enforces immutable `organization_id`, same-tenant foreign
keys, forced RLS, and least-privilege grants. No production Meta credential is
seeded.

# Plan: Phase 6 Private Attachments

## Goal

Implement a private, tenant-isolated attachment workflow for the existing BuildPro public conversation and employee request experiences. Customers and authorized employees will be able to upload JPEG, PNG, and PDF files through short-lived server-issued upload authorization; only validated files will become visible; and every download will require a fresh server authorization check before a short-lived signed URL is issued.

Phase 6 is complete only when attachment metadata and object storage remain consistent, a customer attachment follows the confirmed conversation into the resulting request, an authorized employee can view and download it from the request detail page, cross-tenant access cannot produce an upload or download URL, invalid content never becomes active, and no uploaded file or file content is automatically sent to OpenAI.

## User value

Customers can add plans, site photos, and supporting PDFs to a quotation request without making those documents public. Employees can review the same files from the request dashboard without asking customers to resend them through an insecure channel.

## Current state

Repository inspection on 2026-08-10 found:

- Next.js 16.3, strict TypeScript, Zod, Supabase SSR/client libraries, Vitest, ESLint, Prettier, and npm scripts are configured.
- Supabase local development is configured and Storage is enabled globally with a 50 MiB ceiling, but no application bucket is declared or created.
- `public.attachments` exists with tenant-qualified foreign keys, unique object paths, a tenant path-prefix check, a 50 MiB database ceiling, filename validation, and a MIME allowlist for `image/jpeg`, `image/png`, and `application/pdf`.
- An attachment currently targets exactly one `request_id` or `message_id`. There is no direct `conversation_id`, upload status, expiry, completion, invalidation, deletion, checksum, or malware-scan state.
- Attachment metadata has forced RLS. Authenticated employees can read request attachments only when `private.can_access_request` permits the request; direct authenticated attachment mutation was removed by the Phase 1 hardening migration.
- No policies exist for application access to `storage.objects`, and no browser has broad Storage list/read/write access.
- The employee request repository returns safe attachment metadata (`id`, filename, MIME type, size, creation time), omits bucket/path, and the request detail UI renders a metadata-only attachment list. It has no download or upload action.
- The public chat has opaque-cookie conversation authorization and trusted server-side tenant resolution. It has no attachment UI or attachment route.
- Public confirmation is a transaction-safe security-definer function. It creates the customer and request, links the conversation, creates the initial assignment/history/audit state, and disables further public reads. It does not currently link conversation attachments to the new request.
- Phase 5 includes an `attach_file_to_conversation` tool definition but does not expose or execute attachment capability. Attachment bytes, paths, and content are absent from model context. Phase 6 must preserve that boundary.
- Existing database verification excludes `storage-api` from the reduced CI stack. Real upload/download integration tests therefore need a second Storage-enabled test command or an adjusted CI service profile.
- The working tree contains uncommitted Phase 3-5 work and documentation. Phase 6 implementation must inventory and preserve those changes and must not assume a clean baseline.

## Documentation reconciliation

No contradiction blocks Phase 6 planning. The following details need explicit implementation choices:

1. The API contract documents `POST /api/attachments/presign` and `POST /api/attachments/{id}/complete`; those paths remain the canonical initiation and completion endpoints.
2. The schema models pre-request customer attachments through a message, while the product calls them conversation attachments. Phase 6 will add `conversation_id` and permit a validated attachment to retain conversation provenance while also receiving `request_id` during confirmation. `message_id` remains optional provenance, not the sole parent.
3. The database currently permits up to 50 MiB but the product leaves the operational limit configurable. Phase 6 will use a 10 MiB per-file pilot limit for all three allowed types, enforced by the bucket and server. The existing 50 MiB check remains a defense-in-depth hard ceiling until a data-safe migration can tighten it. Changing the pilot limit later requires coordinated bucket, server, tests, and documentation changes.
4. Supabase signed upload metadata is not sufficient proof of file type because browser MIME declarations are untrusted. Completion must compare the stored size and inspect server-fetched magic bytes before activation.
5. An already-issued signed download URL cannot be revoked immediately. Phase 6 minimizes that window with a 60-second download lifetime and invalidates future signing immediately.
6. The approved roadmap requires attachment upload and viewing, not quotation approval. Enforcing the separate `quotation_sent` business rule against an approved quotation attachment is deferred to the quotation phase.

## Scope

- One version-controlled private Supabase Storage bucket.
- Additive attachment lifecycle and conversation-link schema migration.
- Tenant-scoped randomized object keys that never use the original filename.
- A 10 MiB pilot file-size limit and an exact JPEG/PNG/PDF allowlist.
- Customer upload initiation, direct signed upload, completion validation, listing, download, and pre-confirmation invalidation.
- Employee request upload initiation, completion, listing, signed download, and role-authorized invalidation.
- Atomic attachment linking during public request confirmation.
- Server-side repositories and application services for metadata and Storage operations.
- Customer and employee attachment components with upload progress and safe errors.
- Abandoned-upload cleanup and retry-safe deletion handling.
- A non-blocking malware-scanning extension point and explicit scan state.
- Unit, route/integration, database/RLS, Storage integration, and end-to-end tests.
- Generated database type updates and relevant architecture/API/security documentation updates.

## Out of scope

- Sending a file, signed URL, extracted text, image, or PDF content to OpenAI.
- OpenAI vision, file search, embeddings, OCR, document parsing, or model-generated file summaries.
- Automatic quotations, quotation approval/signing, or the `quotation_sent` workflow.
- Public buckets, permanent URLs, arbitrary object listing, or browser access to the service-role key.
- File sharing outside the owning conversation/request, email/WhatsApp forwarding, or anonymous status-lookup downloads.
- Production-grade malware vendor integration. Phase 6 records scan state and defines the invocation boundary only.
- Additional file formats, archive extraction, media transformation, resumable multipart upload, or thumbnails.
- A generic background-job platform. Cleanup is implemented as an idempotent server script suitable for later scheduling.
- Phase 7 human handoff and Phase 8 status lookup.

## Dependencies and assumptions

- Phases 1-5 remain the behavioral and security baseline.
- The Supabase project has the Storage service enabled in local and hosted environments.
- Server runtime configuration continues to provide the existing Supabase URL and server-only service-role key. No new privileged browser variable is introduced.
- `crypto.randomUUID()` is available in the Node server runtime and is the only source for object-key randomness and upload idempotency identifiers.
- Pilot maximum size is 10 MiB (`10_485_760` bytes) for JPEG, PNG, and PDF. This is a non-blocking plan assumption, recorded in the decision log.
- Signed upload authorization expires after 10 minutes; signed download authorization expires after 60 seconds. Exact supported Supabase API parameters must be verified against the locked client version during implementation.
- Customers may manage attachments only while their opaque conversation access is active and the draft is not confirmed/cancelled. After confirmation, employee request authorization governs access.
- Every attachment belongs to exactly one organization. Target records, uploader membership, paths, and object metadata must agree with that organization.
- Small signature fixtures may be committed under `tests/fixtures/attachments/`; no customer files or credentials may be committed.

## Design

### End-to-end flow

```text
Customer chat or employee request page
  -> POST /api/attachments/presign
     -> authenticate opaque conversation or employee session
     -> resolve organization and target on server
     -> validate declared metadata and rate limit
     -> create pending metadata + randomized path
     -> create short-lived signed upload token
  -> browser uploads bytes directly to the private bucket (no upsert)
  -> POST /api/attachments/{id}/complete
     -> authorize the same target again
     -> inspect the exact stored object, size, signature, and metadata
     -> mark active or reject and remove/quarantine
  -> customer confirms request
     -> existing confirmation transaction links active conversation files
        to the new request
  -> authorized employee opens request
     -> safe metadata list only
     -> POST /api/attachments/{id}/download
     -> authorize request, then issue a 60-second signed URL
```

Routes handle HTTP/cookies/sessions and schemas. `AttachmentService` owns lifecycle, authorization decisions, idempotency, and typed outcomes. Repository modules own PostgreSQL and Supabase Storage calls. React components never receive a service-role client, object path, bucket name, or tenant identifier they can use as authority.

## Private Supabase Storage bucket

- Create bucket ID `private-attachments` in a version-controlled migration by inserting/upserting the reviewed bucket row in `storage.buckets`.
- Set `public = false`, `file_size_limit = 10485760`, and allowed MIME types to exactly `image/jpeg`, `image/png`, and `application/pdf`.
- Update local `supabase/config.toml` to mirror the same bucket settings so local behavior matches the migration and hosted project.
- Do not grant `anon` or `authenticated` broad select, insert, update, delete, or list access on `storage.objects`.
- Signed upload tokens and signed download URLs are minted by server-only code after application authorization. The service-role client may bypass RLS only inside narrowly scoped repository methods that always receive trusted organization/target context.
- Add pgTAP assertions that the bucket exists, is private, has the expected limit/allowlist, and has no permissive public Storage policies.

## Tenant-scoped randomized paths

Canonical object path:

```text
{organization_id}/{target_kind}/{target_id}/{attachment_id}.{canonical_extension}
```

- `target_kind` is `conversation` or `request` and is selected by the server.
- `organization_id`, `target_id`, and `attachment_id` come from trusted records; the browser/model cannot provide the effective tenant or final path.
- `attachment_id` is a server-generated random UUID. Object uploads use `upsert: false`.
- Canonical extensions are `jpg`, `png`, and `pdf`, derived from validated MIME type. The original filename is stored as display metadata only after trimming control characters and enforcing length.
- Strengthen the database path check to validate the complete organization/target/attachment shape where practical, and always compare the stored path to a server-recomputed expected path.
- Never return `storage_path` or `storage_bucket` in public or employee DTOs.

## Allowed file types and size limits

| Type | MIME | Canonical extension | Required signature |
| --- | --- | --- | --- |
| JPEG | `image/jpeg` | `.jpg` | `FF D8 FF` |
| PNG | `image/png` | `.png` | `89 50 4E 47 0D 0A 1A 0A` |
| PDF | `application/pdf` | `.pdf` | `%PDF-` |

- Reject missing, empty, negative, or declared sizes over 10 MiB before issuing upload authorization.
- On completion, treat Storage metadata and claimed MIME as untrusted. Verify actual stored size, read enough initial bytes server-side to identify the signature, and require the claimed MIME, canonical extension, stored object metadata, and detected signature to agree.
- Reject double-extension tricks, unsupported MIME aliases, SVG, HTML, JavaScript, executable content, and a valid extension with invalid bytes.
- Do not parse/render PDFs on the server in Phase 6. Browser display must use download/open behavior and never inject file contents into application HTML.
- Filename validation is for safe display only; escape it in UI and generate a safe `Content-Disposition` name when supported.

## Data model and migration

Create one additive migration after the latest Phase 5 migration. Evolve `public.attachments` with:

- `conversation_id uuid null` with tenant-qualified FK to `conversations` and `ON DELETE RESTRICT`.
- `upload_status text not null` with values `pending`, `validating`, `active`, `rejected`, `abandoned`, `invalidation_pending`, `invalidated`, `deletion_pending`, `deleted`.
- `scan_status text not null` with values `not_scanned`, `pending`, `clean`, `failed`, `infected`.
- `upload_expires_at`, `completed_at`, `invalidated_at`, and `deleted_at` timestamps.
- `client_upload_id uuid not null` for initiation idempotency.
- `uploaded_by_type text not null` with `customer` or `employee`.
- Optional `content_sha256 text` for verified content identity and future scanner handoff.
- Optional `rejection_code text`, constrained to non-sensitive machine codes.
- `created_at` retained; add/update lifecycle timestamps with check constraints enforcing legal combinations.

Replace the exact-one-of-request/message constraint with these invariants:

- At least one of `conversation_id` or `request_id` is present.
- `message_id`, when present, must belong to the same organization and conversation.
- A customer upload must have `conversation_id` and no employee uploader.
- An employee upload must have `uploaded_by_member_id`, whose organization is enforced by the existing composite FK.
- If both conversation and request are present, the request must reference that conversation. Enforce this through a tenant-qualified composite FK or a constraint trigger because a plain check cannot query another table.
- Pending rows have an expiry and no completion timestamp; active rows have a completion timestamp; terminal states cannot be made active by direct browser access.

Add indexes for:

- Active conversation list: `(organization_id, conversation_id, created_at, id)` with a partial predicate.
- Active request list: `(organization_id, request_id, created_at, id)` with a partial predicate.
- Cleanup: `(upload_status, upload_expires_at)` for pending/validating rows.
- Idempotency: unique `(organization_id, client_upload_id)`.
- Optional checksum lookup scoped by organization; it must not silently deduplicate records across customers or targets.

Backfill existing rows conservatively:

- Mark existing valid rows `active`, `completed_at = created_at`, and `scan_status = not_scanned`.
- For message-linked rows, derive `conversation_id` only through the same-organization message FK.
- Derive `uploaded_by_type = employee` when a member exists; otherwise preserve provenance as a controlled legacy value during migration or abort with a preflight assertion. Do not guess customer ownership.
- Abort the migration before constraint replacement if any existing row cannot be reconciled. Never delete an ambiguous row automatically.

Update generated TypeScript database types only after the migration resets successfully.

## Upload initiation

`POST /api/attachments/presign` accepts a discriminated request:

```ts
{
  target: { kind: "conversation"; conversationId: string }
        | { kind: "request"; requestId: string };
  clientUploadId: string;
  filename: string;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  sizeBytes: number;
}
```

- For a conversation target, authenticate with the existing opaque HttpOnly cookie and use the cookie-derived conversation and organization. Reject a body conversation that differs from trusted context.
- For a request target, validate the server session, active membership, request visibility, and a new explicit `attachments:create` permission. Do not infer authorization from a visible button.
- Rate-limit by trusted organization plus conversation/member and by IP hash where available. Use stricter limits than ordinary messages: initially 10 initiations per conversation/member per 15 minutes and no more than 5 non-terminal pending uploads per target.
- Validate metadata before any database row or signed token is created.
- Make initiation idempotent. A repeated `clientUploadId` with identical target/metadata returns the same pending attachment and a refreshed upload token if safe; different metadata returns a typed conflict.
- Create metadata and the server-owned path before generating the upload token. If signing fails, mark initiation rejected or delete the unused pending row in a retry-safe service operation.
- Return only `attachmentId`, `uploadToken`/signed upload data required by the locked Supabase client, expiry, and customer-safe limits. Do not return tenant ID, service credentials, raw object path unless the Supabase signed-upload API technically requires the exact path; if it does, treat that path as an upload capability, not authorization for any other operation.

## Upload completion and metadata validation

`POST /api/attachments/{attachmentId}/complete` accepts only an optional client checksum/version field; it never trusts resubmitted target, path, MIME, size, or tenant fields.

- Re-authorize the current conversation/request and load pending metadata by `(organization_id, attachment_id)`.
- Lock or use a compare-and-set transition from `pending` to `validating` so duplicate completion calls are idempotent and concurrent callers cannot activate twice.
- Retrieve the exact object metadata from Storage, reject missing/wrong-bucket/wrong-path/oversized objects, then inspect its signature server-side.
- Optionally stream the bounded object once to calculate SHA-256 without retaining bytes. Never log content.
- On success, transition to `active`, record actual MIME/size/checksum/completion time, and return safe metadata.
- On a validation failure, mark `rejected` with a stable code and attempt object deletion. If deletion fails, transition to `deletion_pending` for cleanup. Return a customer-safe validation result, not Storage internals.
- If a completion retry finds `active`, return the same safe result. If it finds a terminal rejection/deletion state, return the same stable failure. If another validator owns `validating`, return retryable conflict/accepted status rather than running duplicate work.
- Do not make any attachment visible or downloadable while pending, validating, rejected, abandoned, invalidation-pending, or deletion-pending.

## Conversation and request attachment behavior

### Customer conversation attachments

- Add an attachment panel to the existing BuildPro chat after conversation creation.
- Customer authorization is the existing opaque cookie; organization always comes from the trusted conversation row.
- List only `active` attachments for that exact conversation. Pending local UI items show progress/retry but are not server-visible as completed files.
- Customers may invalidate their own conversation attachments before confirmation/cancellation. They cannot select another conversation, request, organization, or uploader.
- Update `confirm_public_request` in a new migration so the same transaction assigns the newly created `request_id` to every active attachment for the confirmed `(organization_id, conversation_id)`. Keep `conversation_id` for provenance.
- Idempotent confirmation retries must not duplicate or detach attachment metadata.
- Attachments that are still pending/validating at confirmation are not linked to the request and their completion is rejected after the conversation access is disabled. The UI must block confirmation while local uploads are in progress and clearly tell the customer to finish or remove them; the database rule remains authoritative if the UI is bypassed.

### Employee request attachments

- Add `attachments:view`, `attachments:create`, and `attachments:invalidate` permissions. Viewer remains unable to view requests or attachments under current role rules. Map create/invalidate to the roles authorized to update the request; viewing additionally requires `requests:view` and `private.can_access_request`.
- The service validates request access on every initiation, completion, listing, download, and invalidation. Deactivated members fail before Storage calls.
- Employee upload metadata records the active member ID and target request.
- Request detail refreshes its attachment list after successful completion and displays safe type, size, uploader label when allowed, creation time, and lifecycle-safe controls.
- Assignment changes do not weaken access: each later download re-evaluates current request authorization.

## Signed short-lived downloads

`POST /api/attachments/{attachmentId}/download` returns a signed URL and expiry only after:

- validating the attachment ID;
- resolving trusted customer conversation access or active employee membership;
- loading by organization and attachment ID;
- confirming `upload_status = active` and an allowed MIME;
- confirming the attachment is linked to the currently authorized conversation or accessible request; and
- rate-limiting signing requests.

Use a 60-second URL lifetime. Never persist or log the signed URL. Return `Cache-Control: no-store` from the signing endpoint. Customer access ends when the opaque conversation access becomes unreadable at confirmation; subsequent access is employee-only until a future authenticated customer-download design exists.

## Authorization and tenant isolation

- The browser may identify a target, but the server resolves the effective organization from the opaque conversation or authenticated membership.
- All metadata queries and mutations include both `organization_id` and entity ID.
- Composite foreign keys/constraint trigger reject cross-tenant conversation, request, message, and member references.
- RLS permits authenticated employee metadata reads only through the existing request/conversation access functions and only for active attachments. Application mutation remains service-role only through authorized services.
- `anon` receives no direct table or Storage privileges. Public chat routes are controlled server endpoints, not broad public database access.
- The service-role key remains in `server-only` modules. No repository method accepts an organization ID from raw body data without trusted access context.
- Signed upload capability is single path, short lived, non-upsert, and cannot list/read the bucket. Signed download capability is single object and short lived.
- A user from organization A must receive a not-found-style response for organization B attachment, request, conversation, or path identifiers; do not reveal existence.

## Failed, abandoned, and duplicate uploads

- Preserve the selected file in browser state when initiation or completion fails so the customer can retry without losing chat messages or draft fields.
- Use `clientUploadId` and state transitions to make retry and duplicate-click behavior deterministic.
- Expire pending upload authorization after 10 minutes.
- Add an idempotent cleanup script that claims expired `pending`/stale `validating`/`deletion_pending` rows in bounded batches, deletes exact object paths, and advances state to `abandoned` or `deleted`.
- The cleanup script uses server-only credentials, supports dry-run, logs IDs/statuses but no filenames, URLs, tokens, or contents, and never lists/deletes outside `private-attachments` and a validated organization prefix.
- CI tests the cleanup service with a fake Storage repository. Production scheduling is a documented manual deployment step; absence of a scheduler must be listed as a deployment blocker, not hidden.

## Deletion and invalidation

- Treat user deletion as logical invalidation first, followed by physical object deletion. This prevents new signed URLs immediately even when Storage deletion is temporarily unavailable.
- Customer invalidation is limited to the current active pre-confirmation conversation. Employee invalidation requires `attachments:invalidate`, current request access, and a short optional reason.
- Record an audit event for employee upload activation and invalidation. Customer actions use `actor_type = customer/system` metadata without storing the opaque token or IP.
- If object removal succeeds, mark `deleted`; if it fails, mark `deletion_pending` and let cleanup retry.
- Never hard-delete attachment metadata in the request path; retain minimal audit metadata according to the future retention policy. Original object content must not remain accessible after successful deletion.
- Previously issued download URLs may remain valid for at most their 60-second TTL; communicate this as a known limitation.

## Malware-scanning extension point

- Define an `AttachmentScanner` interface that receives a server-side object descriptor or bounded stream and returns `clean`, `infected`, `failed`, or `not_configured` plus a scanner version—never model text.
- Phase 6 uses a `NotConfiguredAttachmentScanner`, records `scan_status = not_scanned`, and relies on strict type/signature/size validation for the pilot.
- Keep scan invocation after object validation and before activation in a feature-gated strict mode. The lifecycle supports `pending`; an infected or failed file never becomes downloadable.
- The extension must be asynchronous-capable so a future scanner does not block large request transactions. Do not send files to OpenAI as a scanning substitute.
- Production security review must decide whether unscanned files are acceptable for the pilot before deployment; the UI should not falsely label them “virus scanned.”

## Customer UI

- Add an accessible attachment picker/drop zone to chat, limited with `accept="image/jpeg,image/png,application/pdf"`; server validation remains authoritative.
- Display allowed types, 10 MiB limit, selected filename/size, upload progress, validating state, success, retryable failure, rejection reason, and remove action.
- Preserve conversation messages and structured draft when upload operations fail.
- Disable the final confirm action while uploads are in progress; explain that the customer must wait or remove the file.
- Show active attachments in the structured summary without exposing paths or signed URLs.
- Open/download through the signing endpoint only on explicit customer action. Revoke object URLs created for local previews.
- Use generic customer-safe messages for authorization/provider failures and specific safe messages for type/size/signature validation.

## Employee UI

- Enhance request detail with an attachment section containing safe metadata, explicit upload control, download/open action, and permitted invalidation action.
- Use server-rendered authorization to decide whether controls render, but enforce every action again in the service/API.
- Add loading/progress, empty, failure, retry, deleted/unavailable, and expired-download states.
- Do not embed permanent URLs. Request a new signed URL only when the employee clicks download/open.
- Do not preview active HTML/SVG (they are disallowed). For PDFs/images, default to a new protected browser context/download; do not render customer-controlled content into application DOM.

## API results and errors

Use typed discriminated application results and the existing API response helpers. Expected safe codes include:

- `invalid_file_type`, `invalid_file_size`, `invalid_file_content`, `invalid_filename`
- `upload_not_found`, `upload_expired`, `upload_in_progress`, `upload_conflict`
- `attachment_not_ready`, `attachment_unavailable`
- `unauthenticated`, `unauthorized`, `rate_limited`, `storage_unavailable`, `internal_error`

Map cross-tenant/not-visible entities to the same not-found response. Never return raw Supabase errors, object keys, bucket internals, stack traces, scanner output, or signed tokens in error logs.

## OpenAI boundary

- Do not add attachment bytes, Base64, signed URLs, object paths, extracted text, filenames, or metadata to `AgentConversationContext`.
- Do not configure Responses API file inputs, vision, file search, or upload endpoints.
- Keep `attach_file_to_conversation` unavailable to the model in Phase 6. The deterministic upload completion service already associates the file with the trusted conversation; a model tool would add no authority or user value.
- If a future phase exposes the tool, it may reference only an already-active attachment ID in the current trusted conversation and must call `AttachmentService`; it must never read file content or claim upload success without a service result.

## Milestones

### 1. Storage and schema foundation

- Add the private bucket migration and local bucket configuration.
- Add lifecycle, conversation linkage, constraints, indexes, RLS updates, and safe backfill.
- Update the confirmation transaction to link active attachments atomically.
- Regenerate database types and add pgTAP coverage.

### 2. Server attachment workflow

- Add validation constants/schemas, typed results, repository contracts, Supabase repository, and `AttachmentService`.
- Implement presign, completion, listing, download-signing, invalidation, and cleanup operations.
- Add employee permissions and customer/employee route authorization.
- Add unit and mocked Storage integration tests.

### 3. Customer and employee UI

- Add chat upload/list/remove/progress behavior and confirmation guard.
- Add employee request upload/list/download/invalidate behavior.
- Preserve safe loading, empty, error, retry, and expired states.

### 4. End-to-end security and hardening

- Run Storage-enabled local tests for real signed upload/download behavior.
- Add cross-tenant, invalid-content, retry, cleanup, and confirmation-link tests.
- Review browser bundles/logs for secrets, object paths, and signed URL leakage.
- Update documentation and record any deviations.

## Expected file changes

Exact migration timestamp/names are selected at implementation time without renaming applied migrations.

Create:

- `supabase/migrations/<timestamp>_phase_6_private_attachments.sql`
- `supabase/tests/009_private_attachments.sql`
- `lib/domain/attachments.ts`
- `lib/schemas/attachment-api.ts`
- `lib/dto/attachment-dto.ts`
- `lib/repositories/attachment-repository.ts`
- `lib/repositories/supabase-attachment-repository.ts`
- `lib/services/attachment-service.ts`
- `lib/services/attachment-runtime.ts`
- `lib/services/attachment-scanner.ts`
- `app/api/attachments/presign/route.ts`
- `app/api/attachments/[attachmentId]/complete/route.ts`
- `app/api/attachments/[attachmentId]/download/route.ts`
- `app/api/attachments/[attachmentId]/route.ts`
- `components/attachments/attachment-uploader.tsx`
- `components/attachments/attachment-list.tsx`
- `scripts/cleanup-abandoned-attachments.mjs`
- `scripts/test-attachment-routes.mjs`
- `tests/unit/attachments/attachment-validation.test.ts`
- `tests/unit/attachments/attachment-service.test.ts`
- `tests/unit/attachments/attachment-routes.test.ts`
- `tests/fixtures/attachments/` containing minimal synthetic valid/invalid fixtures

Modify as needed and only within Phase 6 scope:

- `supabase/config.toml`
- `supabase/migrations/20260808000200_phase_4_security_hardening.sql` must **not** be edited if applied; replace functions through the new Phase 6 migration.
- `supabase/tests/007_public_conversation.sql` or a new Phase 6 test for confirmation linkage
- `lib/supabase/database.types.ts` through the generation command
- `lib/auth/permissions.ts`
- `lib/dto/request-dto.ts`
- `lib/repositories/supabase-request-repository.ts`
- `lib/services/public-conversation-service.ts` only if needed to expose safe attachment state/confirmation blocking
- `components/chat/chat-experience.tsx` (or the actual existing chat container)
- `components/requests/request-detail.tsx`
- existing public conversation and request route test scripts
- `package.json` and `package-lock.json` only for scripts; no production dependency is expected
- `.env.example` only if a non-secret size/TTL/scanner feature flag is made configurable
- `.github/workflows/ci.yml` for a Storage-enabled attachment verification job
- `docs/04_ARCHITECTURE.md`
- `docs/07_API_CONTRACTS.md`
- `docs/08_SECURITY_AND_PRIVACY.md`
- `docs/11_DECISIONS.md`
- this execution plan

## Commands during implementation

Inspect first:

```bash
git status --short
git diff --check
npm ci
npx supabase status
```

Database and generated types:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:types:check
```

The existing reduced `db:start:ci` excludes Storage and is insufficient for signed upload/download E2E. Add and run a dedicated Storage-enabled script such as `npm run db:start:attachments:ci`, or run full `npm run db:start`, before attachment route tests.

Application verification:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Targeted verification during development:

```bash
npx vitest run tests/unit/attachments
node scripts/test-attachment-routes.mjs
node scripts/cleanup-abandoned-attachments.mjs --dry-run
```

Before completion, rerun the full commands, inspect `git status --short`, `git diff --check`, `git diff --stat`, and review the complete Phase 6 diff for unrelated changes. Record only commands actually run and their exact results in Completion notes.

## Test plan

### Unit tests

- Accept exact JPEG, PNG, and PDF MIME/extension/signature combinations.
- Reject unsupported MIME, misleading extension, magic-byte mismatch, empty content, over-limit declared/actual size, unsafe filename, malformed IDs, and path manipulation.
- Generate tenant/target-scoped randomized canonical paths; original filenames never affect paths.
- Initiation idempotency returns the same logical upload; mismatched replay conflicts.
- Completion state machine is idempotent and rejects illegal transitions.
- Download/invalidation authorization requires current target visibility and active status.
- Scanner results keep infected/failed files inactive; default scanner makes no false “clean” claim.
- Cleanup selects only expired/stale rows and never deletes an unvalidated bucket/path.

### Database and RLS tests

- Bucket is private with exact allowlist and size limit.
- Attachment organization, conversation, request, message, member, and path constraints reject cross-tenant references.
- An organization A employee cannot select organization B attachment metadata even with a known UUID.
- An authenticated or anonymous client cannot insert/update/delete attachment metadata directly.
- No public role can list/read/write `storage.objects` through broad policy.
- Active request attachments follow `private.can_access_request`; inactive/deactivated members fail.
- Confirmation links only active attachments from the same organization/conversation and is idempotent.
- Pending/rejected/invalidated/deleted attachments are excluded from active reads.
- Backfill/migration preconditions fail safely on ambiguous legacy rows.

### Route and Storage integration tests

- Customer can initiate, upload, complete, list, download, and invalidate a valid file in the current conversation.
- Authorized employee can do the same for an accessible request.
- Real signed upload cannot overwrite an existing path, list the bucket, or upload after expiry.
- Real signed download works briefly for the exact object and is not permanent.
- Organization A cannot presign, complete, list, sign, or delete organization B data by replacing IDs/paths.
- Public clients cannot enumerate attachments or obtain a request attachment URL.
- Deactivated, unauthenticated, viewer, or unauthorized employee requests fail before Storage calls.
- Browser-resubmitted tenant, target, MIME, size, and path values cannot change trusted metadata.
- Duplicate initiate/complete/delete clicks are stable and do not create duplicate rows/objects.
- Missing object, Storage outage, validation failure, and deletion failure yield safe retry behavior.
- Abandoned pending object cleanup is bounded, tenant-safe, and repeatable.

### End-to-end UI tests

- Customer uploads each allowed type, sees progress and safe metadata in summary, confirms, and the file appears on the employee request.
- No request is created merely by uploading a file.
- Confirmation is blocked while a client upload is active, but bypassing the UI still cannot link an unvalidated file.
- Invalid type, oversized file, and spoofed content display usable errors without losing conversation messages/draft.
- Customer removes a pre-confirmation file and it cannot later be downloaded.
- Employee empty, loading, successful download, expired link retry, invalidation, and provider failure states render correctly.
- OpenAI enabled, disabled, and mocked provider-outage flows never receive attachment content and the deterministic upload journey still works.

## Migration and rollback safety

- Never edit or reorder an applied Phase 1-5 migration. Use a new forward-only Phase 6 migration.
- Run preflight queries for invalid legacy attachments before adding NOT NULL/lifecycle constraints. Abort with a clear exception rather than dropping or reassigning data.
- Add nullable columns, backfill deterministically, validate constraints, then set NOT NULL where safe.
- Create indexes without relying on destructive table rewrites; assess `CONCURRENTLY` for production separately because Supabase migration transactions may not permit it.
- Bucket creation is idempotent but must not change an existing public/conflicting bucket silently. Assert reviewed properties.
- The confirmation function replacement must preserve all Phase 4 security-definer hardening, fixed search path, revocations, service-role-only execution, nonce, idempotency, and audit behavior.
- Rollback means a tested forward migration that disables initiation, invalidates active signing, preserves metadata/audit evidence, and removes the bucket only after an explicit verified-empty check. Never automatically drop a bucket or delete objects in a rollback.
- Take a hosted database backup and inventory the bucket before remote deployment. Apply to local and staging first.

## Security review

- Bucket is private and has no permanent public URLs.
- Tenant identity is resolved from server-authenticated context, never request body, filename, path, or model output.
- Service-role and OpenAI keys remain server-only and are never returned in signed-upload responses.
- Every upload/download/delete is authorized at operation time; hiding UI controls is not security.
- Metadata, stored object properties, and content signature are validated independently.
- Original filenames cannot influence paths, headers without sanitization, HTML, or logs.
- Signed capabilities are exact-object, short-lived, not logged, and returned with no-store responses.
- Cross-tenant failures do not reveal object existence.
- Rate limits, pending-upload caps, idempotency, file-size limits, and cleanup bound abuse and storage consumption.
- Internal notes, employee data, request history, opaque tokens, and other customer data never enter attachment DTOs.
- Attachment content and metadata remain outside OpenAI context and tool execution.
- Audit logs contain identifiers/action/status only, not file bytes, URLs, tokens, or customer filenames.
- Strict type validation is not malware scanning. The deployment decision on accepting `not_scanned` pilot files must be explicit.

## Acceptance criteria

- A `private-attachments` bucket exists through a version-controlled migration and is not public.
- Only JPEG, PNG, and PDF at or below 10 MiB can become active; spoofed content is rejected.
- Object paths are server-generated, randomized, tenant/target scoped, and independent of original filenames.
- Customer and employee uploads use short-lived signed authorization; neither browser receives privileged credentials.
- Completion validates the actual object before activation and is safe under duplicate/concurrent calls.
- A request is not created by upload, and only active conversation attachments are linked atomically on explicit request confirmation.
- Authorized employees can list and obtain a 60-second signed download for accessible request attachments.
- Organization A, public clients, deactivated members, and unauthorized roles cannot obtain metadata, upload authorization, download authorization, or delete organization B files.
- Failed and abandoned uploads are not visible/downloadable and can be cleaned without broad deletion.
- Invalidation blocks new signing immediately and physical deletion is retry-safe.
- Customer and employee UIs include progress, empty, error, retry, expired, and unavailable states.
- No file is automatically sent to OpenAI, and tests prove the agent context/provider adapter receives no attachment content/path/URL.
- Database/RLS, Storage integration, route, unit, UI/E2E, lint, typecheck, all tests, and production build pass.
- Hosted deployment instructions include bucket verification, secrets outside Git, cleanup scheduling, backup, and post-deployment cross-tenant checks.

## Progress log

- [x] Read repository instructions, execution-plan rules, and all user-required Phase 6 documents.
- [x] Read the additional index-required product, workflow, roadmap, and decision documents.
- [x] Inspect the current repository structure, scripts, Supabase configuration, attachment schema/RLS, request repository/UI, public confirmation transaction, and OpenAI boundary.
- [x] Reconcile documentation with current implementation and record non-blocking assumptions.
- [x] Create the Phase 6 execution plan only.
- [x] Establish a reviewed Phase 6 baseline without overwriting existing uncommitted Phase 3-5 work.
- [x] Implement and validate the private bucket and additive database migration.
- [x] Regenerate and verify database types.
- [x] Implement attachment repositories, service, scanner extension, routes, and cleanup.
- [x] Implement customer and employee UI behavior.
- [x] Add database/RLS, unit, route, Storage integration, and end-to-end tests.
- [x] Run all database and application verification commands successfully.
- [x] Review the final diff, documentation, secrets, and browser output.
- [x] Record hosted deployment/manual steps and final results.

## Decision log

- **2026-08-10 — Use one private bucket.** A single `private-attachments` bucket with organization-prefixed randomized paths is simpler to govern and test than per-tenant buckets; authorization remains in server services and database scope.
- **2026-08-10 — Use a 10 MiB pilot limit.** This is below the existing 50 MiB hard ceiling and bounds memory, bandwidth, abuse, and future scanning cost. It is a documented non-blocking assumption pending product telemetry.
- **2026-08-10 — Keep conversation provenance after request confirmation.** Active customer files gain `request_id` atomically while retaining `conversation_id`, avoiding object moves and preserving audit history.
- **2026-08-10 — Validate actual bytes before activation.** Extension and MIME declarations are insufficient; signature and stored-size validation are required.
- **2026-08-10 — Use logical invalidation before object deletion.** Authorization stops immediately while transient Storage deletion failures remain recoverable.
- **2026-08-10 — Do not expose attachment tools to OpenAI.** The deterministic UI/service already performs association, and model involvement would add risk without authority or user value.
- **2026-08-10 — Record, but do not claim, malware scanning.** Phase 6 supplies lifecycle/interface support with `not_scanned`; it must never label files clean without a real scanner result.
- **2026-08-10 — Preserve applied migrations.** The public confirmation function and attachment schema are changed only by a new forward migration.
- **2026-08-10 — Close upload/confirmation races in PostgreSQL.** Confirmation is rejected while a customer attachment is pending or validating, and service-role activation locks the conversation before the attachment so an active file cannot be left without the confirmed request association.
- **2026-08-10 — Fail closed without malware scanning.** The default runtime rejects completion when no scanner is configured. `ATTACHMENT_ALLOW_UNSCANNED=true` is a server-only, explicit pilot exception; it must not be enabled for production acceptance.
- **2026-08-10 — Retain a 24-hour orphan grace period.** Application completion authorization expires after 10 minutes, but cleanup waits 24 hours before deleting pending/validating objects because the provider controls the signed-upload token lifetime. Deletion-pending rows use a short retry schedule.

## Known risks and limitations

- Structural signatures and terminal markers reduce spoofing but are not a substitute for antivirus/malware scanning or a complete format parser.
- Pilot files may remain `not_scanned` only when the server-only `ATTACHMENT_ALLOW_UNSCANNED=true` exception is deliberately configured. The default fails closed, and production must use a real scanner.
- A signed download URL already issued can remain usable for up to 60 seconds after invalidation.
- Direct browser upload can leave an object without active metadata when a client disappears; cleanup is therefore required and must be scheduled in hosted deployment.
- Customer access is intentionally lost after request confirmation because Phase 4 disables public conversation reads. A future authenticated status flow may add customer attachment downloads.
- Full-file SHA-256 calculation can consume server bandwidth up to the 10 MiB limit. Implementation should stream and measure latency before raising the limit.
- Supabase Storage signed-upload semantics must be verified against the locked SDK and local Storage API; the reduced database CI profile alone cannot test them.
- Existing uncommitted Phase 3-5 changes make accidental unrelated edits a material risk. Implementation must isolate and review the Phase 6 diff carefully.

## Completion notes

Implemented on 2026-08-10 without beginning Phase 7.

Delivered one additive Phase 6 migration, the private `private-attachments`
bucket, attachment lifecycle/tenant constraints, active-only employee RLS,
atomic conversation-to-request linking, randomized paths, signed upload and
download services, actual byte validation, customer and employee UI, retry-safe
invalidation/cleanup states, audit events, generated database types, pgTAP
security coverage, unit validation tests, and a real Next.js plus local Supabase
Storage route test. No new production dependency was required.

Implementation deviations from the initial file sketch:

- One reusable `AttachmentUploader` renders both upload controls and lists, so a
  separate `attachment-list.tsx` was unnecessary.
- The real Storage route test is a Node integration script rather than a browser
  framework dependency. It exercises customer and employee upload, completion,
  listing, authorization, download, path non-disclosure, content spoofing, and
  private-bucket behavior.
- Supabase RLS can represent unauthorized bucket listing as a successful empty
  list. Tests therefore assert non-enumeration rather than requiring one exact
  provider error shape.
- Existing legacy attachment rows may retain a legacy bucket/type marker during
  safe migration backfill. All new service-created rows are constrained to the
  private bucket.

Verification completed successfully:

- `npm run db:reset`: all nine migrations applied and production-safe seed ran.
- `npm run db:lint`: no schema errors.
- `npm run db:test`: 135 pgTAP assertions passed; reference concurrency (20
  unique references), Employee Auth (12), protected routes (9), request routes
  (29), public conversation E2E, and Phase 6 real Storage checks passed.
- `npm run lint`: passed with no warnings.
- `npm run typecheck`: passed.
- `npm test`: 21 files and 89 tests passed, including AI evaluations and Phase 6
  validation tests.
- `npm run format:check`: passed after formatting the Phase 6 CSS.
- `npm run build`: Next.js 16.3 production build passed and emitted all Phase 6
  dynamic attachment routes.

Hosted deployment still requires applying the migration with the linked
Supabase CLI, verifying that the hosted bucket is private and limited to the
three MIME types/10 MiB, configuring the cleanup script with server-only
credentials and a scheduler, and running post-deployment cross-tenant upload and
download checks. The not-configured scanner reports `not_scanned`, and
completion now fails closed by default. Local/pilot testing may explicitly set
the server-only `ATTACHMENT_ALLOW_UNSCANNED=true` exception; production requires
a real malware scanner. The follow-up hardening migration also serializes
confirmation with attachment activation and prevents late customer uploads.

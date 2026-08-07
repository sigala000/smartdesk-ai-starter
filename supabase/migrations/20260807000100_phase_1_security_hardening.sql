-- Forward-only hardening after the Phase 1 security audit.

alter table public.requests
  add constraint requests_reference_number_global_key unique (reference_number);

create function private.protect_reference_prefix() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.reference_prefix is distinct from old.reference_prefix
    and (exists (select 1 from public.requests where organization_id = old.id)
      or exists (select 1 from public.request_reference_counters where organization_id = old.id)) then
    raise exception using errcode = '22023', message = 'reference prefix is immutable after first allocation';
  end if;
  return new;
end $$;
revoke all on function private.protect_reference_prefix() from public, anon, authenticated;
create trigger organizations_protect_reference_prefix
before update of reference_prefix on public.organizations
for each row execute function private.protect_reference_prefix();

alter table public.requests alter column service_id set not null;
alter table public.requests add constraint requests_submission_integrity_check check (
  status = 'draft' or (
    confirmed_at is not null
    and description is not null and length(btrim(description)) between 1 and 10000
    and (request_type not in ('quotation','site_visit') or (location is not null and length(btrim(location)) between 1 and 500))
  )
);

alter table public.request_status_history add constraint request_status_history_from_status_check check (
  from_status is null or from_status in ('draft','new','awaiting_customer_information','awaiting_assessment','site_visit_proposed','site_visit_scheduled','assessment_completed','quotation_preparing','quotation_sent','quotation_revision_requested','quotation_accepted','quotation_rejected','scheduled','in_progress','awaiting_client_validation','completed','cancelled','unsupported','inactive','closed')
);
alter table public.request_status_history add constraint request_status_history_to_status_check check (
  to_status in ('draft','new','awaiting_customer_information','awaiting_assessment','site_visit_proposed','site_visit_scheduled','assessment_completed','quotation_preparing','quotation_sent','quotation_revision_requested','quotation_accepted','quotation_rejected','scheduled','in_progress','awaiting_client_validation','completed','cancelled','unsupported','inactive','closed')
);

alter table public.attachments add constraint attachments_bucket_check check (storage_bucket ~ '^[a-z0-9][a-z0-9_-]{1,62}$');
alter table public.attachments add constraint attachments_tenant_path_check check (
  length(storage_path) between 38 and 1024 and storage_path like organization_id::text || '/%'
);
alter table public.attachments add constraint attachments_filename_check check (length(btrim(original_filename)) between 1 and 255);
alter table public.attachments add constraint attachments_mime_type_check check (mime_type in ('image/jpeg','image/png','application/pdf'));

alter table public.messages add constraint messages_content_length_check check (length(content) <= 20000);
alter table public.messages add constraint messages_metadata_size_check check (pg_column_size(metadata) <= 65536);
alter table public.notifications add constraint notifications_title_length_check check (length(btrim(title)) between 1 and 240);
alter table public.notifications add constraint notifications_body_length_check check (length(btrim(body)) between 1 and 4000);
alter table public.audit_events add constraint audit_events_action_length_check check (length(btrim(action)) between 1 and 100);
alter table public.audit_events add constraint audit_events_entity_type_length_check check (length(btrim(entity_type)) between 1 and 100);
alter table public.audit_events add constraint audit_events_metadata_size_check check (pg_column_size(metadata) <= 32768);

drop policy request_status_history_manager_all on public.request_status_history;
drop policy audit_events_manager_all on public.audit_events;
create policy audit_events_manager_read on public.audit_events for select to authenticated
  using (private.is_manager(organization_id));

drop policy attachments_manager_all on public.attachments;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create function private.protect_notification_content() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.organization_id <> old.organization_id
    or new.recipient_member_id <> old.recipient_member_id
    or new.request_id is distinct from old.request_id
    or new.kind <> old.kind or new.title <> old.title or new.body <> old.body
    or new.created_at <> old.created_at then
    raise exception using errcode = '22023', message = 'only notification read_at may be changed';
  end if;
  return new;
end $$;
revoke all on function private.protect_notification_content() from public, anon, authenticated;
create trigger notifications_protect_content before update on public.notifications
for each row execute function private.protect_notification_content();

create index requests_customer_idx on public.requests(organization_id,customer_id,created_at desc);
create index attachments_message_idx on public.attachments(organization_id,message_id) where message_id is not null;
create index assignments_member_idx on public.assignments(organization_id,member_id,assigned_at desc);
create index handoffs_request_idx on public.human_handoffs(organization_id,request_id) where request_id is not null;
create index notifications_request_idx on public.notifications(organization_id,request_id) where request_id is not null;

-- Tenant roots and retained operational history must never disappear through an
-- incidental parent delete. Explicit retention workflows may change this later.
alter table public.organization_members drop constraint organization_members_user_id_fkey,
  add constraint organization_members_user_id_fkey foreign key (user_id) references auth.users(id) on delete restrict;
alter table public.organization_members drop constraint organization_members_organization_id_fkey,
  add constraint organization_members_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.organization_members drop constraint organization_members_department_fk,
  add constraint organization_members_department_fk foreign key (organization_id,department_id) references public.departments(organization_id,id) on delete restrict;

alter table public.departments drop constraint departments_organization_id_fkey,
  add constraint departments_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.services drop constraint services_organization_id_fkey,
  add constraint services_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.services drop constraint services_organization_id_department_id_fkey,
  add constraint services_organization_id_department_id_fkey foreign key (organization_id,department_id) references public.departments(organization_id,id) on delete restrict;
alter table public.customers drop constraint customers_organization_id_fkey,
  add constraint customers_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;

alter table public.conversations drop constraint conversations_organization_id_fkey,
  add constraint conversations_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.conversations drop constraint conversations_organization_id_assigned_member_id_fkey,
  add constraint conversations_organization_id_assigned_member_id_fkey foreign key (organization_id,assigned_member_id) references public.organization_members(organization_id,id) on delete restrict;
alter table public.conversations drop constraint conversations_request_fk,
  add constraint conversations_request_fk foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete restrict deferrable initially deferred;

alter table public.requests drop constraint requests_organization_id_fkey,
  add constraint requests_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.requests drop constraint requests_organization_id_service_id_fkey,
  add constraint requests_organization_id_service_id_fkey foreign key (organization_id,service_id) references public.services(organization_id,id) on delete restrict;
alter table public.requests drop constraint requests_organization_id_department_id_fkey,
  add constraint requests_organization_id_department_id_fkey foreign key (organization_id,department_id) references public.departments(organization_id,id) on delete restrict;
alter table public.requests drop constraint requests_organization_id_assigned_member_id_fkey,
  add constraint requests_organization_id_assigned_member_id_fkey foreign key (organization_id,assigned_member_id) references public.organization_members(organization_id,id) on delete restrict;

alter table public.messages drop constraint messages_organization_id_fkey,
  add constraint messages_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.messages drop constraint messages_organization_id_conversation_id_fkey,
  add constraint messages_organization_id_conversation_id_fkey foreign key (organization_id,conversation_id) references public.conversations(organization_id,id) on delete restrict;
alter table public.messages drop constraint messages_organization_id_sender_member_id_fkey,
  add constraint messages_organization_id_sender_member_id_fkey foreign key (organization_id,sender_member_id) references public.organization_members(organization_id,id) on delete restrict;

alter table public.request_status_history drop constraint request_status_history_organization_id_fkey,
  add constraint request_status_history_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.request_status_history drop constraint request_status_history_organization_id_request_id_fkey,
  add constraint request_status_history_organization_id_request_id_fkey foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete restrict;
alter table public.request_status_history drop constraint request_status_history_organization_id_changed_by_member_i_fkey,
  add constraint request_status_history_organization_id_changed_by_member_i_fkey foreign key (organization_id,changed_by_member_id) references public.organization_members(organization_id,id) on delete restrict;

alter table public.assignments drop constraint assignments_organization_id_fkey,
  add constraint assignments_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.assignments drop constraint assignments_organization_id_request_id_fkey,
  add constraint assignments_organization_id_request_id_fkey foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete restrict;
alter table public.assignments drop constraint assignments_organization_id_assigned_by_member_id_fkey,
  add constraint assignments_organization_id_assigned_by_member_id_fkey foreign key (organization_id,assigned_by_member_id) references public.organization_members(organization_id,id) on delete restrict;

alter table public.attachments drop constraint attachments_organization_id_fkey,
  add constraint attachments_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.attachments drop constraint attachments_organization_id_request_id_fkey,
  add constraint attachments_organization_id_request_id_fkey foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete restrict;
alter table public.attachments drop constraint attachments_organization_id_message_id_fkey,
  add constraint attachments_organization_id_message_id_fkey foreign key (organization_id,message_id) references public.messages(organization_id,id) on delete restrict;
alter table public.attachments drop constraint attachments_organization_id_uploaded_by_member_id_fkey,
  add constraint attachments_organization_id_uploaded_by_member_id_fkey foreign key (organization_id,uploaded_by_member_id) references public.organization_members(organization_id,id) on delete restrict;

alter table public.internal_notes drop constraint internal_notes_organization_id_fkey,
  add constraint internal_notes_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.internal_notes drop constraint internal_notes_organization_id_request_id_fkey,
  add constraint internal_notes_organization_id_request_id_fkey foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete restrict;

alter table public.human_handoffs drop constraint human_handoffs_organization_id_fkey,
  add constraint human_handoffs_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.human_handoffs drop constraint human_handoffs_organization_id_conversation_id_fkey,
  add constraint human_handoffs_organization_id_conversation_id_fkey foreign key (organization_id,conversation_id) references public.conversations(organization_id,id) on delete restrict;
alter table public.human_handoffs drop constraint human_handoffs_organization_id_request_id_fkey,
  add constraint human_handoffs_organization_id_request_id_fkey foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete restrict;
alter table public.human_handoffs drop constraint human_handoffs_organization_id_assigned_member_id_fkey,
  add constraint human_handoffs_organization_id_assigned_member_id_fkey foreign key (organization_id,assigned_member_id) references public.organization_members(organization_id,id) on delete restrict;

alter table public.knowledge_documents drop constraint knowledge_documents_organization_id_fkey,
  add constraint knowledge_documents_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.knowledge_documents drop constraint knowledge_documents_organization_id_service_id_fkey,
  add constraint knowledge_documents_organization_id_service_id_fkey foreign key (organization_id,service_id) references public.services(organization_id,id) on delete restrict;
alter table public.knowledge_documents drop constraint knowledge_documents_organization_id_approved_by_member_id_fkey,
  add constraint knowledge_documents_organization_id_approved_by_member_id_fkey foreign key (organization_id,approved_by_member_id) references public.organization_members(organization_id,id) on delete restrict;

alter table public.notifications drop constraint notifications_organization_id_fkey,
  add constraint notifications_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.notifications drop constraint notifications_organization_id_recipient_member_id_fkey,
  add constraint notifications_organization_id_recipient_member_id_fkey foreign key (organization_id,recipient_member_id) references public.organization_members(organization_id,id) on delete restrict;
alter table public.notifications drop constraint notifications_organization_id_request_id_fkey,
  add constraint notifications_organization_id_request_id_fkey foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete restrict;

alter table public.feedback drop constraint feedback_organization_id_fkey,
  add constraint feedback_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.feedback drop constraint feedback_organization_id_request_id_fkey,
  add constraint feedback_organization_id_request_id_fkey foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete restrict;
alter table public.request_reference_counters drop constraint request_reference_counters_organization_id_fkey,
  add constraint request_reference_counters_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.audit_events drop constraint audit_events_organization_id_fkey,
  add constraint audit_events_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.audit_events drop constraint audit_events_organization_id_actor_member_id_fkey,
  add constraint audit_events_organization_id_actor_member_id_fkey foreign key (organization_id,actor_member_id) references public.organization_members(organization_id,id) on delete restrict;

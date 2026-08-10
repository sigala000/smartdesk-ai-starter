-- Phase 6: private, tenant-isolated attachment lifecycle.

do $$
begin
  if exists (
    select 1 from storage.buckets
    where id = 'private-attachments'
      and (public or file_size_limit is distinct from 10485760
        or allowed_mime_types is distinct from array['image/jpeg','image/png','application/pdf']::text[])
  ) then
    raise exception 'private_attachments_bucket_conflict';
  end if;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('private-attachments','private-attachments',false,10485760,array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

alter table public.attachments
  add column conversation_id uuid,
  add column upload_status text not null default 'active',
  add column scan_status text not null default 'not_scanned',
  add column upload_expires_at timestamptz,
  add column completed_at timestamptz,
  add column invalidated_at timestamptz,
  add column deleted_at timestamptz,
  add column client_upload_id uuid not null default gen_random_uuid(),
  add column uploaded_by_type text not null default 'legacy',
  add column content_sha256 text,
  add column rejection_code text;

update public.attachments a
set conversation_id = m.conversation_id
from public.messages m
where a.organization_id = m.organization_id and a.message_id = m.id;

update public.attachments
set completed_at = created_at,
    uploaded_by_type = case when uploaded_by_member_id is null then 'legacy' else 'employee' end;

alter table public.attachments drop constraint attachments_check;
alter table public.attachments
  add constraint attachments_conversation_fk foreign key (organization_id,conversation_id)
    references public.conversations(organization_id,id) on delete restrict,
  add constraint attachments_target_check check (conversation_id is not null or request_id is not null),
  add constraint attachments_upload_status_check check (upload_status in ('pending','validating','active','rejected','abandoned','invalidation_pending','invalidated','deletion_pending','deleted')),
  add constraint attachments_scan_status_check check (scan_status in ('not_scanned','pending','clean','failed','infected')),
  add constraint attachments_uploader_type_check check (uploaded_by_type in ('customer','employee','legacy')),
  add constraint attachments_uploader_check check (
    (uploaded_by_type = 'customer' and conversation_id is not null and uploaded_by_member_id is null)
    or (uploaded_by_type = 'employee' and uploaded_by_member_id is not null)
    or uploaded_by_type = 'legacy'
  ),
  add constraint attachments_lifecycle_check check (
    (upload_status = 'pending' and upload_expires_at is not null and completed_at is null)
    or (upload_status in ('validating','rejected','abandoned') and completed_at is null)
    or (upload_status = 'active' and (completed_at is not null or uploaded_by_type = 'legacy') and invalidated_at is null and deleted_at is null)
    or (upload_status in ('invalidation_pending','invalidated') and invalidated_at is not null)
    or (upload_status = 'deletion_pending' and invalidated_at is not null)
    or (upload_status = 'deleted' and deleted_at is not null)
  ),
  add constraint attachments_sha256_check check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  add constraint attachments_rejection_code_check check (rejection_code is null or rejection_code ~ '^[a-z_]{1,60}$'),
  add constraint attachments_private_bucket_check check (uploaded_by_type = 'legacy' or storage_bucket = 'private-attachments');

create unique index attachments_client_upload_unique on public.attachments(organization_id,client_upload_id);
create index attachments_active_conversation_idx on public.attachments(organization_id,conversation_id,created_at,id) where upload_status='active' and conversation_id is not null;
create index attachments_active_request_idx on public.attachments(organization_id,request_id,created_at,id) where upload_status='active' and request_id is not null;
create index attachments_cleanup_idx on public.attachments(upload_status,upload_expires_at) where upload_status in ('pending','validating','deletion_pending');

drop policy attachments_request_read on public.attachments;
create policy attachments_active_request_read on public.attachments for select to authenticated using (
  upload_status = 'active' and request_id is not null and private.can_access_request(organization_id,request_id)
);

create function private.validate_attachment_relationships() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_message_conversation uuid;
  v_request_conversation uuid;
begin
  if new.message_id is not null then
    select conversation_id into v_message_conversation from public.messages
      where organization_id=new.organization_id and id=new.message_id;
    if v_message_conversation is null or new.conversation_id is distinct from v_message_conversation then
      raise exception using errcode='23514', message='attachment_message_mismatch';
    end if;
  end if;
  if new.request_id is not null and new.conversation_id is not null then
    select conversation_id into v_request_conversation from public.requests
      where organization_id=new.organization_id and id=new.request_id;
    if v_request_conversation is distinct from new.conversation_id then
      raise exception using errcode='23514', message='attachment_request_mismatch';
    end if;
  end if;
  return new;
end $$;

create trigger validate_attachment_relationships
before insert or update of organization_id,conversation_id,request_id,message_id on public.attachments
for each row execute function private.validate_attachment_relationships();

create function private.link_confirmed_conversation_attachments() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.request_id is not null and old.request_id is distinct from new.request_id then
    update public.attachments
      set request_id = new.request_id
      where organization_id=new.organization_id and conversation_id=new.id
        and request_id is null and upload_status='active';
  end if;
  return new;
end $$;

create trigger link_confirmed_conversation_attachments
after update of request_id on public.conversations
for each row execute function private.link_confirmed_conversation_attachments();

revoke all on storage.objects from anon, authenticated;
revoke all on storage.buckets from anon, authenticated;

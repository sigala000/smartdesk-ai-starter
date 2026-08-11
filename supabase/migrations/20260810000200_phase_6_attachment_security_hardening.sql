-- Close customer upload/confirmation races and make final activation atomic.

create function private.guard_customer_attachment_lifecycle() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_request_id uuid;
  v_state text;
begin
  if new.uploaded_by_type <> 'customer' or new.conversation_id is null then
    return new;
  end if;
  select request_id, state into v_request_id, v_state
    from public.conversations
    where organization_id = new.organization_id and id = new.conversation_id;
  if v_request_id is not null and new.request_id is distinct from v_request_id then
    raise exception using errcode='23514', message='attachment_conversation_confirmed';
  end if;
  if v_state in ('resolved','closed') and new.request_id is null then
    raise exception using errcode='23514', message='attachment_conversation_closed';
  end if;
  return new;
end $$;

create trigger guard_customer_attachment_lifecycle
before insert or update of organization_id,conversation_id,request_id,upload_status on public.attachments
for each row execute function private.guard_customer_attachment_lifecycle();

create function private.block_confirmation_during_attachment_upload() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.request_id is not null and old.request_id is distinct from new.request_id
    and exists (
      select 1 from public.attachments a
      where a.organization_id = new.organization_id
        and a.conversation_id = new.id
        and a.uploaded_by_type = 'customer'
        and a.upload_status in ('pending','validating')
    ) then
    raise exception using errcode='55000', message='attachment_upload_in_progress';
  end if;
  return new;
end $$;

create trigger block_confirmation_during_attachment_upload
before update of request_id on public.conversations
for each row execute function private.block_confirmation_during_attachment_upload();

create function public.activate_private_attachment(
  p_organization_id uuid,
  p_attachment_id uuid,
  p_actual_size bigint,
  p_sha256 text
) returns setof public.attachments
language plpgsql security definer set search_path = '' as $$
declare
  v_conversation_id uuid;
  v_confirmed_request_id uuid;
  v_attachment public.attachments;
begin
  if p_actual_size < 1 or p_actual_size > 10485760
    or p_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023', message='invalid_attachment_activation';
  end if;

  select conversation_id into v_conversation_id
    from public.attachments
    where organization_id=p_organization_id and id=p_attachment_id;
  if not found then
    raise exception using errcode='P0002', message='attachment_not_found';
  end if;

  if v_conversation_id is not null then
    select request_id into v_confirmed_request_id
      from public.conversations
      where organization_id=p_organization_id and id=v_conversation_id
      for update;
  end if;

  select * into v_attachment from public.attachments
    where organization_id=p_organization_id and id=p_attachment_id
    for update;
  if v_attachment.upload_status <> 'validating' then
    raise exception using errcode='55000', message='attachment_not_validating';
  end if;
  if v_attachment.conversation_id is distinct from v_conversation_id then
    raise exception using errcode='40001', message='attachment_changed';
  end if;

  update public.attachments set
    upload_status='active',
    request_id=coalesce(request_id,v_confirmed_request_id),
    size_bytes=p_actual_size,
    content_sha256=p_sha256,
    completed_at=now(),
    upload_expires_at=null,
    rejection_code=null
  where organization_id=p_organization_id and id=p_attachment_id
  returning * into v_attachment;
  return next v_attachment;
end $$;

revoke all on function public.activate_private_attachment(uuid,uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.activate_private_attachment(uuid,uuid,bigint,text) to service_role;


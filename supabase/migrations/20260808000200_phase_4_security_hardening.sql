alter table public.conversation_drafts
  add column confirmation_idempotency_key uuid;

alter table public.public_conversation_access
  add column read_disabled_at timestamptz;

create or replace function public.process_public_message(
  p_conversation_id uuid,
  p_token_digest text,
  p_client_message_id uuid,
  p_expected_version integer,
  p_customer_content text,
  p_reply text,
  p_intent text,
  p_request_type text,
  p_service_id uuid,
  p_customer_name text,
  p_phone text,
  p_phone_confirmed_at timestamptz,
  p_email text,
  p_description text,
  p_location text,
  p_preferred_start_date date,
  p_budget_min numeric,
  p_budget_max numeric,
  p_stage text,
  p_cancelled_at timestamptz
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_organization_id uuid;
  v_customer_message_id uuid;
  v_current_version integer;
begin
  select a.organization_id into v_organization_id
  from public.public_conversation_access a
  join public.conversations c
    on c.organization_id = a.organization_id and c.id = a.conversation_id
  where a.conversation_id = p_conversation_id
    and a.token_digest = p_token_digest
    and a.revoked_at is null and a.expires_at > now()
    and a.read_disabled_at is null
  for update of a;
  if v_organization_id is null then
    raise exception using errcode = 'P0002', message = 'conversation_not_found';
  end if;

  select m.id into v_customer_message_id
  from public.messages m
  where m.organization_id = v_organization_id
    and m.conversation_id = p_conversation_id
    and m.client_message_id = p_client_message_id;
  if v_customer_message_id is not null then
    return true;
  end if;

  select d.version into v_current_version
  from public.conversation_drafts d
  where d.organization_id = v_organization_id and d.conversation_id = p_conversation_id
  for update;
  if v_current_version is null then
    raise exception using errcode = 'P0002', message = 'conversation_not_found';
  end if;
  if v_current_version <> p_expected_version then
    raise exception using errcode = '40001', message = 'stale_draft';
  end if;

  insert into public.messages(organization_id, conversation_id, sender_type, client_message_id, content)
  values (v_organization_id, p_conversation_id, 'customer', p_client_message_id, p_customer_content)
  returning id into v_customer_message_id;

  update public.conversation_drafts set
    intent = p_intent,
    request_type = p_request_type,
    service_id = p_service_id,
    customer_name = p_customer_name,
    phone = p_phone,
    phone_confirmed_at = p_phone_confirmed_at,
    email = p_email,
    description = p_description,
    location = p_location,
    preferred_start_date = p_preferred_start_date,
    budget_min = p_budget_min,
    budget_max = p_budget_max,
    stage = p_stage,
    cancelled_at = p_cancelled_at,
    confirmation_nonce_digest = null,
    confirmation_nonce_expires_at = null,
    confirmation_idempotency_key = null,
    version = version + 1
  where organization_id = v_organization_id and conversation_id = p_conversation_id;

  insert into public.messages(organization_id, conversation_id, sender_type, reply_to_message_id, content)
  values (v_organization_id, p_conversation_id, 'assistant', v_customer_message_id, p_reply);
  return false;
end $$;

revoke all on function public.process_public_message(uuid,text,uuid,integer,text,text,text,text,uuid,text,text,timestamptz,text,text,text,date,numeric,numeric,text,timestamptz) from public, anon, authenticated;
grant execute on function public.process_public_message(uuid,text,uuid,integer,text,text,text,text,uuid,text,text,timestamptz,text,text,text,date,numeric,numeric,text,timestamptz) to service_role;

create or replace function public.confirm_public_request(
  p_conversation_id uuid,
  p_token_digest text,
  p_nonce_digest text,
  p_idempotency_key uuid
) returns table(id uuid, reference_number text, status text, created_at timestamptz, replayed boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_conversation public.conversations;
  v_draft public.conversation_drafts;
  v_customer public.customers;
  v_request public.requests;
  v_department public.departments;
begin
  select c.* into v_conversation
  from public.conversations c
  join public.public_conversation_access a
    on a.organization_id = c.organization_id and a.conversation_id = c.id
  where c.id = p_conversation_id and a.token_digest = p_token_digest
    and a.revoked_at is null and a.expires_at > now()
  for update of c;
  if v_conversation.id is null then
    raise exception using errcode = 'P0002', message = 'conversation_not_found';
  end if;

  select * into v_draft from public.conversation_drafts
    where organization_id = v_conversation.organization_id and conversation_id = v_conversation.id for update;
  if v_conversation.request_id is not null then
    if v_draft.confirmation_idempotency_key is distinct from p_idempotency_key then
      raise exception using errcode = '23505', message = 'idempotency_conflict';
    end if;
    select * into v_request from public.requests
      where organization_id = v_conversation.organization_id and id = v_conversation.request_id;
    return query select v_request.id, v_request.reference_number, v_request.status, v_request.created_at, true;
    return;
  end if;
  if v_draft.stage <> 'review' or v_draft.customer_name is null or v_draft.phone is null
    or v_draft.phone_confirmed_at is null or v_draft.service_id is null
    or v_draft.description is null or v_draft.location is null then
    raise exception using errcode = '23514', message = 'draft_incomplete';
  end if;
  if v_draft.confirmation_nonce_digest is distinct from p_nonce_digest
    or v_draft.confirmation_nonce_expires_at is null or v_draft.confirmation_nonce_expires_at <= now()
    or v_draft.summary_version <> v_draft.version then
    raise exception using errcode = '23514', message = 'confirmation_nonce_invalid';
  end if;
  if not exists (select 1 from public.services s where s.organization_id = v_conversation.organization_id and s.id = v_draft.service_id and s.is_active) then
    raise exception using errcode = '23514', message = 'service_unavailable';
  end if;

  select * into v_request from public.requests where organization_id = v_conversation.organization_id and idempotency_key = p_idempotency_key;
  if v_request.id is not null then
    if v_request.conversation_id is distinct from v_conversation.id then
      raise exception using errcode = '23505', message = 'idempotency_conflict';
    end if;
    return query select v_request.id, v_request.reference_number, v_request.status, v_request.created_at, true;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_conversation.organization_id::text || ':' || v_draft.phone, 0));
  select * into v_customer from public.customers where organization_id = v_conversation.organization_id and phone = v_draft.phone order by created_at limit 1 for update;
  if v_customer.id is null then
    insert into public.customers(organization_id, full_name, phone, email, consent_to_contact)
      values (v_conversation.organization_id, btrim(v_draft.customer_name), v_draft.phone, v_draft.email, false)
      returning * into v_customer;
  end if;

  select d.* into v_department from public.services s join public.departments d on d.organization_id = s.organization_id and d.id = s.department_id and d.is_active
    where s.organization_id = v_conversation.organization_id and s.id = v_draft.service_id;
  if v_department.id is null then
    select * into v_department from public.departments where organization_id = v_conversation.organization_id and name = 'Commercial Department' and is_active;
  end if;
  if v_department.id is null then raise exception using errcode = '23514', message = 'routing_unavailable'; end if;

  perform set_config('smartdesk.status_source', 'public_conversation', true);
  insert into public.requests(organization_id, customer_id, conversation_id, service_id, department_id, reference_number, request_type, status, title, description, location, idempotency_key, confirmed_at, preferred_start_date, budget_min, budget_max, budget_currency)
  values (v_conversation.organization_id, v_customer.id, v_conversation.id, v_draft.service_id, v_department.id, null, coalesce(v_draft.request_type, 'quotation'), 'new', left(btrim(v_draft.description), 240), btrim(v_draft.description), btrim(v_draft.location), p_idempotency_key, now(), v_draft.preferred_start_date, v_draft.budget_min, v_draft.budget_max, case when v_draft.budget_min is null and v_draft.budget_max is null then null else v_draft.budget_currency end)
  returning * into v_request;
  update public.conversations set customer_id = v_customer.id, request_id = v_request.id, state = 'resolved' where organization_id = v_conversation.organization_id and id = v_conversation.id;
  insert into public.assignments(organization_id, request_id, department_id, member_id, assigned_by_member_id, reason) values (v_conversation.organization_id, v_request.id, v_department.id, null, null, 'Initial public request routing');
  update public.conversation_drafts set stage = 'confirmed', confirmed_at = now(), confirmation_nonce_digest = null, confirmation_nonce_expires_at = null, confirmation_idempotency_key = p_idempotency_key, version = version + 1 where organization_id = v_conversation.organization_id and conversation_id = v_conversation.id;
  update public.public_conversation_access set read_disabled_at = now() where organization_id = v_conversation.organization_id and conversation_id = v_conversation.id;
  insert into public.audit_events(organization_id, action, entity_type, entity_id, metadata) values (v_conversation.organization_id, 'request.created', 'request', v_request.id, jsonb_build_object('source', 'public_conversation', 'department_id', v_department.id));
  return query select v_request.id, v_request.reference_number, v_request.status, v_request.created_at, false;
end $$;

revoke all on function public.confirm_public_request(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.confirm_public_request(uuid,text,text,uuid) to service_role;

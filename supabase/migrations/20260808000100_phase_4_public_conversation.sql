alter table public.conversations alter column customer_id drop not null;

alter table public.requests
  add column preferred_start_date date,
  add column budget_min numeric(14,2) check (budget_min is null or budget_min >= 0),
  add column budget_max numeric(14,2) check (budget_max is null or budget_max >= 0),
  add column budget_currency text check (budget_currency is null or budget_currency = 'XAF'),
  add constraint requests_budget_range_check check (budget_min is null or budget_max is null or budget_min <= budget_max);

alter table public.messages
  add column client_message_id uuid,
  add column reply_to_message_id uuid;

alter table public.messages add constraint messages_reply_to_fk
  foreign key (organization_id, reply_to_message_id)
  references public.messages(organization_id, id) on delete cascade;
alter table public.messages add constraint messages_public_ids_check check (
  (sender_type = 'customer' and client_message_id is not null and reply_to_message_id is null)
  or (sender_type = 'assistant' and client_message_id is null)
  or (sender_type not in ('customer', 'assistant') and client_message_id is null and reply_to_message_id is null)
);
create unique index messages_client_message_unique
  on public.messages(organization_id, conversation_id, client_message_id)
  where client_message_id is not null;
create unique index messages_assistant_reply_unique
  on public.messages(organization_id, reply_to_message_id)
  where reply_to_message_id is not null;

create table public.conversation_drafts (
  conversation_id uuid primary key,
  organization_id uuid not null,
  intent text check (intent in ('request_quotation','request_site_visit','ask_about_services','check_request_status','report_problem','speak_to_employee')),
  request_type text check (request_type in ('quotation','site_visit','support')),
  service_id uuid,
  customer_name text check (customer_name is null or length(btrim(customer_name)) between 2 and 160),
  phone text check (phone is null or length(btrim(phone)) between 9 and 20),
  phone_confirmed_at timestamptz,
  email text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  description text check (description is null or length(btrim(description)) between 10 and 2000),
  location text check (location is null or length(btrim(location)) between 2 and 500),
  preferred_start_date date,
  budget_min numeric(14,2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(14,2) check (budget_max is null or budget_max >= 0),
  budget_currency text not null default 'XAF' check (budget_currency = 'XAF'),
  stage text not null default 'choose_action' check (stage in ('choose_action','choose_service','collect_name','collect_phone','confirm_phone','collect_description','collect_location','collect_email','collect_start','collect_budget','review','edit_menu','confirmed','cancelled')),
  edit_field text check (edit_field is null or edit_field in ('service','customer_name','phone','description','location','email','preferred_start_date','budget')),
  version integer not null default 1 check (version > 0),
  summary_version integer not null default 0 check (summary_version >= 0),
  confirmation_nonce_digest text,
  confirmation_nonce_expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, conversation_id),
  foreign key (organization_id, conversation_id) references public.conversations(organization_id, id) on delete cascade,
  foreign key (organization_id, service_id) references public.services(organization_id, id) on delete restrict,
  check (budget_min is null or budget_max is null or budget_min <= budget_max),
  check ((phone_confirmed_at is null) or phone is not null),
  check ((confirmed_at is null) or stage = 'confirmed'),
  check ((cancelled_at is null) or stage = 'cancelled')
);

create table public.public_conversation_access (
  conversation_id uuid primary key,
  organization_id uuid not null,
  token_digest text not null check (token_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, conversation_id),
  unique (token_digest),
  foreign key (organization_id, conversation_id) references public.conversations(organization_id, id) on delete cascade,
  check (expires_at > created_at)
);

create table public.public_rate_limits (
  id bigint generated always as identity primary key,
  organization_id uuid,
  action text not null check (length(action) between 1 and 40),
  subject_digest text not null check (subject_digest ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  unique nulls not distinct (organization_id, action, subject_digest, window_started_at),
  foreign key (organization_id) references public.organizations(id) on delete cascade
);

create index public_conversation_access_expiry_idx on public.public_conversation_access(expires_at) where revoked_at is null;
create index public_rate_limits_expiry_idx on public.public_rate_limits(expires_at);
create index customers_phone_public_idx on public.customers(organization_id, phone) where phone is not null;

create trigger conversation_drafts_updated_at before update on public.conversation_drafts
  for each row execute function private.set_updated_at();
create trigger conversation_drafts_organization_immutable before update on public.conversation_drafts
  for each row execute function private.enforce_organization_immutable();
create trigger public_conversation_access_organization_immutable before update on public.public_conversation_access
  for each row execute function private.enforce_organization_immutable();

alter table public.conversation_drafts enable row level security;
alter table public.conversation_drafts force row level security;
alter table public.public_conversation_access enable row level security;
alter table public.public_conversation_access force row level security;
alter table public.public_rate_limits enable row level security;
alter table public.public_rate_limits force row level security;

revoke all on public.conversation_drafts from public, anon, authenticated;
revoke all on public.public_conversation_access from public, anon, authenticated;
revoke all on public.public_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.conversation_drafts to service_role;
grant select, insert, update, delete on public.public_conversation_access to service_role;
grant select, insert, update, delete on public.public_rate_limits to service_role;
grant usage, select on sequence public.public_rate_limits_id_seq to service_role;
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

create function public.consume_public_rate_limit(
  p_organization_id uuid,
  p_action text,
  p_subject_digest text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_limit not between 1 and 1000 or p_window_seconds not between 1 and 86400
    or p_action !~ '^[a-z_]{1,40}$' or p_subject_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_rate_limit_input';
  end if;
  if p_organization_id is not null and not exists (
    select 1 from public.organizations where id = p_organization_id and is_active
  ) then
    return false;
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.public_rate_limits(organization_id, action, subject_digest, window_started_at, expires_at)
    values (p_organization_id, p_action, p_subject_digest, v_window, v_window + make_interval(secs => p_window_seconds))
  on conflict (organization_id, action, subject_digest, window_started_at)
    do update set request_count = public.public_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= p_limit;
end $$;

create function public.confirm_public_request(
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
    or v_draft.confirmation_nonce_expires_at is null or v_draft.confirmation_nonce_expires_at <= now() then
    raise exception using errcode = '23514', message = 'confirmation_nonce_invalid';
  end if;
  if not exists (
    select 1 from public.services s where s.organization_id = v_conversation.organization_id
      and s.id = v_draft.service_id and s.is_active
  ) then
    raise exception using errcode = '23514', message = 'service_unavailable';
  end if;

  select * into v_request from public.requests
    where organization_id = v_conversation.organization_id and idempotency_key = p_idempotency_key;
  if v_request.id is not null then
    if v_request.conversation_id is distinct from v_conversation.id then
      raise exception using errcode = '23505', message = 'idempotency_conflict';
    end if;
    return query select v_request.id, v_request.reference_number, v_request.status, v_request.created_at, true;
    return;
  end if;

  select * into v_customer from public.customers
    where organization_id = v_conversation.organization_id and phone = v_draft.phone
    order by created_at limit 1 for update;
  if v_customer.id is null then
    insert into public.customers(organization_id, full_name, phone, email, consent_to_contact)
      values (v_conversation.organization_id, btrim(v_draft.customer_name), v_draft.phone, v_draft.email, false)
      returning * into v_customer;
  end if;

  select d.* into v_department from public.services s
    join public.departments d on d.organization_id = s.organization_id and d.id = s.department_id and d.is_active
    where s.organization_id = v_conversation.organization_id and s.id = v_draft.service_id;
  if v_department.id is null then
    select * into v_department from public.departments
      where organization_id = v_conversation.organization_id and name = 'Commercial Department' and is_active;
  end if;
  if v_department.id is null then
    raise exception using errcode = '23514', message = 'routing_unavailable';
  end if;

  perform set_config('smartdesk.status_source', 'public_conversation', true);
  insert into public.requests(
    organization_id, customer_id, conversation_id, service_id, department_id,
    reference_number, request_type, status, title, description, location,
    idempotency_key, confirmed_at, preferred_start_date, budget_min, budget_max, budget_currency
  ) values (
    v_conversation.organization_id, v_customer.id, v_conversation.id, v_draft.service_id, v_department.id,
    null, coalesce(v_draft.request_type, 'quotation'), 'new',
    left(btrim(v_draft.description), 240), btrim(v_draft.description), btrim(v_draft.location),
    p_idempotency_key, now(), v_draft.preferred_start_date, v_draft.budget_min, v_draft.budget_max,
    case when v_draft.budget_min is null and v_draft.budget_max is null then null else v_draft.budget_currency end
  ) returning * into v_request;

  update public.conversations set customer_id = v_customer.id, request_id = v_request.id, state = 'resolved'
    where organization_id = v_conversation.organization_id and id = v_conversation.id;
  insert into public.assignments(organization_id, request_id, department_id, member_id, assigned_by_member_id, reason)
    values (v_conversation.organization_id, v_request.id, v_department.id, null, null, 'Initial public request routing');
  update public.conversation_drafts set stage = 'confirmed', confirmed_at = now(),
    confirmation_nonce_digest = null, confirmation_nonce_expires_at = null, version = version + 1
    where organization_id = v_conversation.organization_id and conversation_id = v_conversation.id;
  insert into public.audit_events(organization_id, action, entity_type, entity_id, metadata)
    values (v_conversation.organization_id, 'request.created', 'request', v_request.id,
      jsonb_build_object('source', 'public_conversation', 'department_id', v_department.id));

  return query select v_request.id, v_request.reference_number, v_request.status, v_request.created_at, false;
end $$;

create function public.create_public_conversation(
  p_organization_slug text,
  p_token_digest text
) returns table(conversation_id uuid, organization_id uuid, organization_name text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_organization public.organizations;
  v_conversation public.conversations;
begin
  if p_token_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_token_digest';
  end if;
  select * into v_organization from public.organizations
    where slug = p_organization_slug and is_active;
  if v_organization.id is null then
    raise exception using errcode = 'P0002', message = 'organization_not_found';
  end if;
  insert into public.conversations(organization_id, customer_id, state)
    values (v_organization.id, null, 'open') returning * into v_conversation;
  insert into public.conversation_drafts(organization_id, conversation_id)
    values (v_organization.id, v_conversation.id);
  insert into public.public_conversation_access(organization_id, conversation_id, token_digest, expires_at)
    values (v_organization.id, v_conversation.id, p_token_digest, now() + interval '24 hours');
  insert into public.messages(organization_id, conversation_id, sender_type, content)
    values (v_organization.id, v_conversation.id, 'assistant',
      'Hello, I’m BuildPro Cameroon’s virtual assistant. I can guide you through a request one question at a time.');
  return query select v_conversation.id, v_organization.id, v_organization.name, v_conversation.created_at;
end $$;

revoke all on function public.consume_public_rate_limit(uuid,text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.confirm_public_request(uuid,text,text,uuid) from public, anon, authenticated;
revoke all on function public.create_public_conversation(text,text) from public, anon, authenticated;
grant execute on function public.consume_public_rate_limit(uuid,text,text,integer,integer) to service_role;
grant execute on function public.confirm_public_request(uuid,text,text,uuid) to service_role;
grant execute on function public.create_public_conversation(text,text) to service_role;

-- Phase 10: self-service tenants, provider-owned WhatsApp connections, and
-- provider-independent SmartDesk subscriptions. All changes are additive.

alter table public.organizations
  add column lifecycle_status text not null default 'active'
    check (lifecycle_status in ('onboarding','active','suspended','closed')),
  add column onboarding_completed_at timestamptz,
  add column contact_email text check (contact_email is null or contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  add column contact_phone text check (contact_phone is null or length(btrim(contact_phone)) between 6 and 32),
  add column website_url text check (website_url is null or website_url ~ '^https://'),
  add column industry text check (industry is null or length(btrim(industry)) between 1 and 120);

update public.organizations
set lifecycle_status='active', onboarding_completed_at=coalesce(onboarding_completed_at,created_at)
where is_active;

create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','suspended','cancelled')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null,
  current_period_ends_at timestamptz,
  feature_entitlements jsonb not null default '{"web_chat":true,"employee_dashboard":true,"whatsapp":false}'::jsonb
    check (jsonb_typeof(feature_entitlements)='object'),
  provider text,
  provider_customer_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id), unique (organization_id),
  foreign key (organization_id) references public.organizations(id) on delete restrict,
  check (trial_ends_at > trial_started_at)
);

insert into public.organization_subscriptions(organization_id,status,trial_started_at,trial_ends_at,feature_entitlements)
select id,'active',created_at,created_at+interval '100 years',
  '{"web_chat":true,"employee_dashboard":true,"whatsapp":true}'::jsonb
from public.organizations
on conflict (organization_id) do nothing;

alter table public.whatsapp_accounts drop constraint whatsapp_accounts_is_test_check;
alter table public.whatsapp_accounts
  add column mode text not null default 'developer_test'
    check (mode in ('developer_test','production')),
  add column connection_status text not null default 'connected'
    check (connection_status in ('not_connected','connecting','connected','action_required','disconnected')),
  add column display_name text check (display_name is null or length(btrim(display_name)) between 1 and 160),
  add column graph_api_version text check (graph_api_version is null or graph_api_version ~ '^v[0-9]{1,2}\.[0-9]$'),
  add column quality_rating text check (quality_rating is null or quality_rating in ('GREEN','YELLOW','RED','UNKNOWN')),
  add column messaging_limit_tier text check (messaging_limit_tier is null or length(messaging_limit_tier) between 1 and 80),
  add column billing_status text not null default 'unknown'
    check (billing_status in ('unknown','ready','action_required','not_applicable')),
  add column capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities)='object'),
  add column connected_by_member_id uuid,
  add column connected_at timestamptz,
  add column disconnected_at timestamptz,
  add column last_health_check_at timestamptz,
  add column last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,80}$'),
  add constraint whatsapp_accounts_connected_member_fk
    foreign key (organization_id,connected_by_member_id)
    references public.organization_members(organization_id,id) on delete restrict,
  add constraint whatsapp_accounts_mode_consistency check (
    (mode='developer_test' and is_test=true) or (mode='production' and is_test=false)
  );

create table public.whatsapp_developer_test_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  whatsapp_account_id uuid not null,
  wa_id text not null check (wa_id ~ '^[0-9]{6,20}$'),
  label text check (label is null or length(btrim(label)) between 1 and 80),
  is_active boolean not null default true,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id), unique (whatsapp_account_id,wa_id),
  foreign key (organization_id,whatsapp_account_id)
    references public.whatsapp_accounts(organization_id,id) on delete restrict,
  foreign key (organization_id,created_by_member_id)
    references public.organization_members(organization_id,id) on delete restrict
);

create table public.whatsapp_credential_envelopes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  whatsapp_account_id uuid not null,
  credential_kind text not null default 'cloud_api_access_token'
    check (credential_kind='cloud_api_access_token'),
  key_version integer not null check (key_version between 1 and 32767),
  ciphertext text not null check (length(ciphertext) between 16 and 16384),
  initialization_vector text not null check (length(initialization_vector) between 12 and 64),
  authentication_tag text not null check (length(authentication_tag) between 12 and 64),
  expires_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id), unique (whatsapp_account_id,credential_kind),
  foreign key (organization_id,whatsapp_account_id)
    references public.whatsapp_accounts(organization_id,id) on delete restrict
);

create table public.meta_embedded_signup_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requested_by_member_id uuid not null,
  state_digest text not null unique check (state_digest ~ '^[a-f0-9]{64}$'),
  expected_origin text not null check (expected_origin ~ '^https?://'),
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed','expired')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  whatsapp_account_id uuid,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,80}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete restrict,
  foreign key (organization_id,requested_by_member_id)
    references public.organization_members(organization_id,id) on delete restrict,
  foreign key (organization_id,whatsapp_account_id)
    references public.whatsapp_accounts(organization_id,id) on delete restrict,
  check (expires_at > created_at),
  check ((status='completed' and consumed_at is not null and whatsapp_account_id is not null)
    or status<>'completed')
);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  email text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role text not null check (role in ('admin','manager','commercial_officer','technical_officer','project_manager','support_officer','viewer')),
  department_id uuid,
  token_digest text not null unique check (token_digest ~ '^[a-f0-9]{64}$'),
  invited_by_member_id uuid not null,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete restrict,
  foreign key (organization_id,department_id) references public.departments(organization_id,id) on delete restrict,
  foreign key (organization_id,invited_by_member_id) references public.organization_members(organization_id,id) on delete restrict,
  check (expires_at > created_at)
);
create unique index organization_invitations_one_pending_email
  on public.organization_invitations(organization_id,lower(email)) where status='pending';

create index whatsapp_accounts_org_status_idx on public.whatsapp_accounts(organization_id,connection_status);
create index whatsapp_accounts_waba_idx on public.whatsapp_accounts(whatsapp_business_account_id);
create index whatsapp_signup_pending_idx on public.meta_embedded_signup_attempts(organization_id,status,expires_at);
create index organization_subscriptions_status_idx on public.organization_subscriptions(status,trial_ends_at);

do $$ declare t text; begin
  foreach t in array array['organization_subscriptions','whatsapp_developer_test_recipients','whatsapp_credential_envelopes','meta_embedded_signup_attempts','organization_invitations'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function private.set_updated_at()',t,t);
    execute format('create trigger %I_organization_immutable before update on public.%I for each row execute function private.enforce_organization_immutable()',t,t);
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end $$;

-- Credential envelopes and signup state are deliberately never exposed through RLS.
create policy subscriptions_member_read on public.organization_subscriptions for select to authenticated
  using (private.is_active_member(organization_id));
create policy test_recipients_admin_all on public.whatsapp_developer_test_recipients for all to authenticated
  using (private.member_role(organization_id) in ('admin','manager'))
  with check (private.member_role(organization_id) in ('admin','manager'));
create policy invitations_admin_all on public.organization_invitations for all to authenticated
  using (private.member_role(organization_id) in ('admin','manager'))
  with check (private.member_role(organization_id) in ('admin','manager'));
grant select on public.organization_subscriptions to authenticated;
grant select,insert,update,delete on public.whatsapp_developer_test_recipients,public.organization_invitations to authenticated;

drop policy if exists whatsapp_accounts_read on public.whatsapp_accounts;
create policy whatsapp_accounts_admin_read on public.whatsapp_accounts for select to authenticated
  using (private.member_role(organization_id) in ('admin','manager'));
grant select on public.whatsapp_accounts to authenticated;

create function public.create_owner_organization(
  p_name text,
  p_slug text,
  p_reference_prefix text,
  p_display_name text,
  p_trial_days integer default 14
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_organization_id uuid;
begin
  if v_user is null then raise exception using errcode='42501',message='authentication_required'; end if;
  if exists(select 1 from public.organization_members where user_id=v_user and is_active) then
    raise exception using errcode='23505',message='active_membership_exists';
  end if;
  if length(btrim(p_name)) not between 2 and 160
    or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or p_reference_prefix !~ '^[A-Z0-9]{2,10}$'
    or length(btrim(p_display_name)) not between 2 and 160
    or p_trial_days not between 1 and 90 then
    raise exception using errcode='22023',message='invalid_organization';
  end if;
  insert into public.organizations(name,slug,reference_prefix,timezone,default_language,is_active,lifecycle_status)
  values(btrim(p_name),p_slug,p_reference_prefix,'Africa/Douala','en',true,'onboarding') returning id into v_organization_id;
  insert into public.organization_members(organization_id,user_id,role,display_name,is_active)
  values(v_organization_id,v_user,'admin',btrim(p_display_name),true);
  insert into public.organization_subscriptions(organization_id,status,trial_started_at,trial_ends_at,feature_entitlements)
  values(v_organization_id,'trialing',now(),now()+make_interval(days=>p_trial_days),
    '{"web_chat":true,"employee_dashboard":true,"whatsapp":true}'::jsonb);
  insert into public.audit_events(organization_id,actor_member_id,action,entity_type,entity_id,metadata)
  select v_organization_id,m.id,'organization.created','organization',v_organization_id,
    jsonb_build_object('source','self_service_onboarding')
  from public.organization_members m where m.organization_id=v_organization_id and m.user_id=v_user;
  return v_organization_id;
end $$;
revoke all on function public.create_owner_organization(text,text,text,text,integer) from public,anon;
grant execute on function public.create_owner_organization(text,text,text,text,integer) to authenticated;

create function public.accept_organization_invitation(p_token_digest text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_email text:=lower(coalesce(auth.jwt()->>'email','')); v_invitation public.organization_invitations;
begin
  if v_user is null or p_token_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='42501',message='invitation_invalid';
  end if;
  select * into v_invitation from public.organization_invitations
    where token_digest=p_token_digest and status='pending' and expires_at>now() for update;
  if not found or lower(v_invitation.email)<>v_email then
    raise exception using errcode='42501',message='invitation_invalid';
  end if;
  if exists(select 1 from public.organization_members where user_id=v_user and is_active and organization_id<>v_invitation.organization_id) then
    raise exception using errcode='23505',message='active_membership_exists';
  end if;
  insert into public.organization_members(organization_id,user_id,role,department_id,display_name,is_active)
  values(v_invitation.organization_id,v_user,v_invitation.role,v_invitation.department_id,
    left(coalesce(nullif(auth.jwt()->'user_metadata'->>'full_name',''),split_part(v_email,'@',1)),160),true)
  on conflict (organization_id,user_id) do update set role=excluded.role,department_id=excluded.department_id,is_active=true;
  update public.organization_invitations set status='accepted',accepted_at=now() where id=v_invitation.id;
  return v_invitation.organization_id;
end $$;
revoke all on function public.accept_organization_invitation(text) from public,anon;
grant execute on function public.accept_organization_invitation(text) to authenticated;

-- Public web conversations are available only after explicit tenant activation.
create or replace function public.create_public_conversation(
  p_organization_slug text,
  p_token_digest text
) returns table(conversation_id uuid,organization_id uuid,organization_name text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_organization public.organizations; v_conversation public.conversations;
begin
  if p_token_digest !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='invalid_token_digest'; end if;
  select * into v_organization from public.organizations
    where slug=p_organization_slug and is_active and lifecycle_status='active'
      and exists(select 1 from public.organization_subscriptions s
        where s.organization_id=organizations.id
          and s.feature_entitlements @> '{"web_chat":true}'::jsonb
          and (s.status='active' or (s.status='trialing' and s.trial_ends_at>now())));
  if not found then raise exception using errcode='P0002',message='organization_not_found'; end if;
  insert into public.conversations(organization_id,customer_id,state)
    values(v_organization.id,null,'open') returning * into v_conversation;
  insert into public.conversation_drafts(organization_id,conversation_id) values(v_organization.id,v_conversation.id);
  insert into public.public_conversation_access(organization_id,conversation_id,token_digest,expires_at)
    values(v_organization.id,v_conversation.id,p_token_digest,now()+interval '24 hours');
  insert into public.messages(organization_id,conversation_id,sender_type,content)
    values(v_organization.id,v_conversation.id,'assistant',
      'Hello, I’m '||v_organization.name||'’s virtual assistant. I can guide you through a request one question at a time.');
  return query select v_conversation.id,v_organization.id,v_organization.name,v_conversation.created_at;
end $$;
revoke all on function public.create_public_conversation(text,text) from public,anon,authenticated;
grant execute on function public.create_public_conversation(text,text) to service_role;

-- Ingestion now accepts both explicitly configured developer-test accounts and
-- connected production accounts. The destination pair remains authoritative.
create or replace function public.resolve_whatsapp_account(
  p_phone_number_id text,p_whatsapp_business_account_id text,p_wa_id text
) returns table(organization_id uuid,account_id uuid,mode text,recipient_allowed boolean)
language sql security definer set search_path='' as $$
  select a.organization_id,a.id,a.mode,
    case when a.mode='production' then true else exists(
      select 1 from public.whatsapp_developer_test_recipients r
      where r.organization_id=a.organization_id and r.whatsapp_account_id=a.id
        and r.wa_id=p_wa_id and r.is_active
    ) end
  from public.whatsapp_accounts a
  join public.organizations o on o.id=a.organization_id
  join public.organization_subscriptions s on s.organization_id=a.organization_id
  where a.phone_number_id=p_phone_number_id
    and a.whatsapp_business_account_id=p_whatsapp_business_account_id
    and a.is_active and a.connection_status='connected'
    and o.is_active and o.lifecycle_status='active'
    and (s.status='active' or (s.status='trialing' and s.trial_ends_at>now()))
  limit 1
$$;
revoke all on function public.resolve_whatsapp_account(text,text,text) from public,anon,authenticated;
grant execute on function public.resolve_whatsapp_account(text,text,text) to service_role;

create or replace function public.ingest_whatsapp_text_message(
  p_phone_number_id text,p_whatsapp_business_account_id text,p_wa_id text,p_profile_name text,
  p_provider_message_id text,p_provider_timestamp timestamptz,p_client_message_id uuid,
  p_access_token_digest text,p_trace_id uuid
) returns table(
  created boolean,organization_id uuid,account_id uuid,identity_id uuid,
  conversation_id uuid,access_token_digest text,delivery_id uuid,
  client_message_id uuid,delivery_status text
) language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
  v_account public.whatsapp_accounts; v_identity public.whatsapp_identities;
  v_mapping public.whatsapp_conversations; v_customer_id uuid;
  v_delivery public.whatsapp_message_deliveries; v_matches integer;
begin
  if p_wa_id !~ '^[0-9]{6,20}$' or length(p_provider_message_id) not between 3 and 256
    or p_access_token_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='invalid_whatsapp_message';
  end if;
  select a.* into v_account from public.whatsapp_accounts a
    join public.organizations o on o.id=a.organization_id and o.is_active and o.lifecycle_status='active'
    join public.organization_subscriptions s on s.organization_id=a.organization_id
      and (s.status='active' or (s.status='trialing' and s.trial_ends_at>now()))
    where a.phone_number_id=p_phone_number_id
      and a.whatsapp_business_account_id=p_whatsapp_business_account_id
      and a.is_active and a.connection_status='connected'
      and (a.mode='production' or exists(
        select 1 from public.whatsapp_developer_test_recipients r
        where r.organization_id=a.organization_id and r.whatsapp_account_id=a.id
          and r.wa_id=p_wa_id and r.is_active
      )) for update of a;
  if not found then raise exception using errcode='P0002',message='whatsapp_account_not_found'; end if;
  select * into v_delivery from public.whatsapp_message_deliveries
    where whatsapp_account_id=v_account.id and provider_message_id=p_provider_message_id;
  if found then
    select * into v_mapping from public.whatsapp_conversations
      where organization_id=v_delivery.organization_id and conversation_id=v_delivery.conversation_id;
    return query select false,v_delivery.organization_id,v_delivery.whatsapp_account_id,v_delivery.whatsapp_identity_id,
      v_delivery.conversation_id,v_mapping.access_token_digest,v_delivery.id,v_delivery.client_message_id,v_delivery.status;
    return;
  end if;
  select * into v_identity from public.whatsapp_identities
    where whatsapp_account_id=v_account.id and wa_id=p_wa_id for update;
  if not found then
    select count(*),(array_agg(id))[1] into v_matches,v_customer_id from public.customers
      where organization_id=v_account.organization_id and phone=('+'||p_wa_id);
    if v_matches<>1 then
      insert into public.customers(organization_id,full_name,phone,consent_to_contact)
      values(v_account.organization_id,null,'+'||p_wa_id,false) returning id into v_customer_id;
    end if;
    insert into public.whatsapp_identities(organization_id,whatsapp_account_id,wa_id,customer_id,profile_name)
    values(v_account.organization_id,v_account.id,p_wa_id,v_customer_id,left(nullif(btrim(p_profile_name),''),160))
    returning * into v_identity;
  end if;
  select * into v_mapping from public.whatsapp_conversations
    where whatsapp_account_id=v_account.id and whatsapp_identity_id=v_identity.id and state='active' for update;
  if not found then
    insert into public.conversations(organization_id,customer_id,channel,state)
      values(v_account.organization_id,v_identity.customer_id,'whatsapp','open') returning id into v_customer_id;
    insert into public.conversation_drafts(organization_id,conversation_id) values(v_account.organization_id,v_customer_id);
    insert into public.public_conversation_access(organization_id,conversation_id,token_digest,expires_at)
      values(v_account.organization_id,v_customer_id,p_access_token_digest,now()+interval '30 days');
    insert into public.whatsapp_conversations(organization_id,whatsapp_account_id,whatsapp_identity_id,conversation_id,access_token_digest)
      values(v_account.organization_id,v_account.id,v_identity.id,v_customer_id,p_access_token_digest) returning * into v_mapping;
  end if;
  insert into public.whatsapp_message_deliveries(
    organization_id,whatsapp_account_id,whatsapp_identity_id,conversation_id,direction,
    provider_message_id,client_message_id,provider_timestamp,status,trace_id)
  values(v_account.organization_id,v_account.id,v_identity.id,v_mapping.conversation_id,'inbound',
    p_provider_message_id,p_client_message_id,p_provider_timestamp,'received',p_trace_id)
  returning * into v_delivery;
  return query select true,v_account.organization_id,v_account.id,v_identity.id,v_mapping.conversation_id,
    v_mapping.access_token_digest,v_delivery.id,v_delivery.client_message_id,v_delivery.status;
end $$;
revoke all on function public.ingest_whatsapp_text_message(text,text,text,text,text,timestamptz,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.ingest_whatsapp_text_message(text,text,text,text,text,timestamptz,uuid,text,uuid) to service_role;

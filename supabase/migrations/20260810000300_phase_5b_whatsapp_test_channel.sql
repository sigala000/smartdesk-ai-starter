-- Meta WhatsApp Cloud API developer-test transport. No credentials are stored here.

alter table public.conversations drop constraint conversations_channel_check;
alter table public.conversations add constraint conversations_channel_check
  check (channel in ('web','whatsapp')) not valid;
alter table public.conversations validate constraint conversations_channel_check;

create table public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  phone_number_id text not null check (phone_number_id ~ '^[0-9]{5,32}$'),
  whatsapp_business_account_id text not null check (whatsapp_business_account_id ~ '^[0-9]{5,32}$'),
  display_phone_number text check (display_phone_number is null or length(display_phone_number) between 6 and 32),
  is_test boolean not null default true check (is_test),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (phone_number_id),
  unique (organization_id,whatsapp_business_account_id,phone_number_id),
  foreign key (organization_id) references public.organizations(id) on delete restrict
);

create table public.whatsapp_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  whatsapp_account_id uuid not null,
  wa_id text not null check (wa_id ~ '^[0-9]{6,20}$'),
  customer_id uuid not null,
  profile_name text check (profile_name is null or length(profile_name) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (whatsapp_account_id,wa_id),
  foreign key (organization_id,whatsapp_account_id) references public.whatsapp_accounts(organization_id,id) on delete restrict,
  foreign key (organization_id,customer_id) references public.customers(organization_id,id) on delete restrict
);

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  whatsapp_account_id uuid not null,
  whatsapp_identity_id uuid not null,
  conversation_id uuid not null,
  access_token_digest text not null check (access_token_digest ~ '^[a-f0-9]{64}$'),
  state text not null default 'active' check (state in ('active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  unique (organization_id,conversation_id),
  foreign key (organization_id,whatsapp_account_id) references public.whatsapp_accounts(organization_id,id) on delete restrict,
  foreign key (organization_id,whatsapp_identity_id) references public.whatsapp_identities(organization_id,id) on delete restrict,
  foreign key (organization_id,conversation_id) references public.conversations(organization_id,id) on delete restrict
);
create unique index whatsapp_conversations_one_active_identity
  on public.whatsapp_conversations(whatsapp_account_id,whatsapp_identity_id) where state='active';

create table public.whatsapp_message_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  whatsapp_account_id uuid not null,
  whatsapp_identity_id uuid,
  conversation_id uuid,
  message_id uuid,
  reply_to_delivery_id uuid,
  direction text not null check (direction in ('inbound','outbound')),
  provider_message_id text check (provider_message_id is null or length(provider_message_id) between 3 and 256),
  client_message_id uuid,
  provider_timestamp timestamptz,
  status text not null check (status in ('received','processing','processed','queued','sent','delivered','read','failed','unsupported')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  processing_started_at timestamptz,
  next_attempt_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,60}$'),
  trace_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id,whatsapp_account_id) references public.whatsapp_accounts(organization_id,id) on delete restrict,
  foreign key (organization_id,whatsapp_identity_id) references public.whatsapp_identities(organization_id,id) on delete restrict,
  foreign key (organization_id,conversation_id) references public.conversations(organization_id,id) on delete restrict,
  foreign key (organization_id,message_id) references public.messages(organization_id,id) on delete restrict,
  foreign key (organization_id,reply_to_delivery_id) references public.whatsapp_message_deliveries(organization_id,id) on delete restrict,
  check ((direction='inbound' and provider_message_id is not null and client_message_id is not null and reply_to_delivery_id is null)
      or (direction='outbound' and client_message_id is null and reply_to_delivery_id is not null))
);
create unique index whatsapp_deliveries_provider_unique
  on public.whatsapp_message_deliveries(whatsapp_account_id,provider_message_id) where provider_message_id is not null;
create unique index whatsapp_deliveries_reply_unique
  on public.whatsapp_message_deliveries(organization_id,reply_to_delivery_id) where reply_to_delivery_id is not null;
create index whatsapp_deliveries_retry_idx on public.whatsapp_message_deliveries(organization_id,status,next_attempt_at);
create index whatsapp_deliveries_conversation_idx on public.whatsapp_message_deliveries(organization_id,conversation_id,created_at);

create trigger whatsapp_accounts_updated_at before update on public.whatsapp_accounts for each row execute function private.set_updated_at();
create trigger whatsapp_identities_updated_at before update on public.whatsapp_identities for each row execute function private.set_updated_at();
create trigger whatsapp_conversations_updated_at before update on public.whatsapp_conversations for each row execute function private.set_updated_at();
create trigger whatsapp_deliveries_updated_at before update on public.whatsapp_message_deliveries for each row execute function private.set_updated_at();
create trigger whatsapp_accounts_organization_immutable before update on public.whatsapp_accounts for each row execute function private.enforce_organization_immutable();
create trigger whatsapp_identities_organization_immutable before update on public.whatsapp_identities for each row execute function private.enforce_organization_immutable();
create trigger whatsapp_conversations_organization_immutable before update on public.whatsapp_conversations for each row execute function private.enforce_organization_immutable();
create trigger whatsapp_deliveries_organization_immutable before update on public.whatsapp_message_deliveries for each row execute function private.enforce_organization_immutable();

do $$ declare t text; begin
  foreach t in array array['whatsapp_accounts','whatsapp_identities','whatsapp_conversations','whatsapp_message_deliveries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end $$;

create function public.ingest_whatsapp_text_message(
  p_phone_number_id text,
  p_whatsapp_business_account_id text,
  p_wa_id text,
  p_profile_name text,
  p_provider_message_id text,
  p_provider_timestamp timestamptz,
  p_client_message_id uuid,
  p_access_token_digest text,
  p_trace_id uuid
) returns table(
  created boolean, organization_id uuid, account_id uuid, identity_id uuid,
  conversation_id uuid, access_token_digest text, delivery_id uuid,
  client_message_id uuid, delivery_status text
) language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
  v_account public.whatsapp_accounts;
  v_identity public.whatsapp_identities;
  v_mapping public.whatsapp_conversations;
  v_customer_id uuid;
  v_delivery public.whatsapp_message_deliveries;
  v_matches integer;
begin
  if p_wa_id !~ '^[0-9]{6,20}$' or length(p_provider_message_id) not between 3 and 256
    or p_access_token_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='invalid_whatsapp_message';
  end if;
  select * into v_account from public.whatsapp_accounts
    where phone_number_id=p_phone_number_id
      and whatsapp_business_account_id=p_whatsapp_business_account_id
      and is_active and is_test for update;
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
    if v_matches <> 1 then
      insert into public.customers(organization_id,full_name,phone,consent_to_contact)
      values(v_account.organization_id,null,'+'||p_wa_id,false)
      returning id into v_customer_id;
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

create function public.claim_whatsapp_delivery(p_organization_id uuid,p_delivery_id uuid)
returns boolean language sql security definer set search_path='' as $$
  update public.whatsapp_message_deliveries set status='processing',attempt_count=attempt_count+1,processing_started_at=now()
  where organization_id=p_organization_id and id=p_delivery_id and direction='inbound' and attempt_count<10
    and (status='received' or (status='processing' and processing_started_at < now()-interval '2 minutes'))
  returning true
$$;

create function public.complete_whatsapp_delivery(
  p_organization_id uuid,p_delivery_id uuid,p_message_id uuid,p_trace_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  update public.whatsapp_message_deliveries set status='processed',message_id=p_message_id,last_error_code=null
    where organization_id=p_organization_id and id=p_delivery_id and direction='inbound';
  insert into public.whatsapp_message_deliveries(
    organization_id,whatsapp_account_id,whatsapp_identity_id,conversation_id,message_id,reply_to_delivery_id,
    direction,status,trace_id,next_attempt_at)
  select organization_id,whatsapp_account_id,whatsapp_identity_id,conversation_id,p_message_id,id,'outbound','queued',p_trace_id,now()
    from public.whatsapp_message_deliveries where organization_id=p_organization_id and id=p_delivery_id
  on conflict (organization_id,reply_to_delivery_id) where reply_to_delivery_id is not null
  do update set message_id=excluded.message_id returning id into v_id;
  return v_id;
end $$;

create function public.update_whatsapp_delivery_status(
  p_phone_number_id text,p_provider_message_id text,p_status text,p_error_code text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_rank integer; v_updated integer;
begin
  if p_status not in ('sent','delivered','read','failed') then return false; end if;
  v_rank:=case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end;
  update public.whatsapp_message_deliveries d set status=p_status,last_error_code=case when p_status='failed' then p_error_code else null end
  from public.whatsapp_accounts a where a.id=d.whatsapp_account_id and a.phone_number_id=p_phone_number_id
    and d.direction='outbound' and d.provider_message_id=p_provider_message_id
    and ((p_status='failed' and d.status not in ('delivered','read'))
      or (p_status<>'failed' and (case d.status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end) <= v_rank));
  get diagnostics v_updated=row_count; return v_updated=1;
end $$;

create function public.restore_whatsapp_conversation_access(
  p_organization_id uuid,p_conversation_id uuid
) returns boolean language sql security definer set search_path='' as $$
  update public.public_conversation_access a set read_disabled_at=null
  where a.organization_id=p_organization_id and a.conversation_id=p_conversation_id
    and exists(select 1 from public.whatsapp_conversations w where w.organization_id=p_organization_id
      and w.conversation_id=p_conversation_id and w.state='active')
  returning true
$$;

revoke all on function public.ingest_whatsapp_text_message(text,text,text,text,text,timestamptz,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.claim_whatsapp_delivery(uuid,uuid) from public,anon,authenticated;
revoke all on function public.complete_whatsapp_delivery(uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.update_whatsapp_delivery_status(text,text,text,text) from public,anon,authenticated;
revoke all on function public.restore_whatsapp_conversation_access(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ingest_whatsapp_text_message(text,text,text,text,text,timestamptz,uuid,text,uuid) to service_role;
grant execute on function public.claim_whatsapp_delivery(uuid,uuid) to service_role;
grant execute on function public.complete_whatsapp_delivery(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.update_whatsapp_delivery_status(text,text,text,text) to service_role;
grant execute on function public.restore_whatsapp_conversation_access(uuid,uuid) to service_role;

-- Production connection activation and operations foundations. Existing
-- developer-test rows remain connected and are not reclassified.
alter table public.whatsapp_accounts drop constraint if exists whatsapp_accounts_connection_status_check;
alter table public.whatsapp_accounts
  add constraint whatsapp_accounts_connection_status_check check (connection_status in (
    'not_connected','connecting','connected','action_required','disconnected',
    'authorization_pending','authorized','number_registration_pending','webhook_pending',
    'billing_required','test_pending','active','degraded','suspended','revoked'
  )),
  add column last_successful_webhook_at timestamptz,
  add column last_successful_outbound_at timestamptz,
  add column webhook_subscribed boolean not null default false;

create unique index whatsapp_accounts_phone_number_unique_idx on public.whatsapp_accounts(phone_number_id);

create function private.enforce_whatsapp_waba_tenant() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.whatsapp_accounts a
    where a.whatsapp_business_account_id = new.whatsapp_business_account_id
      and a.organization_id <> new.organization_id
      and a.id <> new.id
  ) then raise exception using errcode = '23514', message = 'whatsapp_waba_tenant_mismatch'; end if;
  return new;
end $$;
create trigger whatsapp_accounts_waba_tenant_guard
  before insert or update of organization_id, whatsapp_business_account_id on public.whatsapp_accounts
  for each row execute function private.enforce_whatsapp_waba_tenant();

create table public.whatsapp_suppressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  whatsapp_account_id uuid not null,
  recipient_digest text not null check (recipient_digest ~ '^[0-9a-f]{64}$'),
  reason text not null check (reason in ('customer_opt_out','administrator','legal')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (organization_id, id),
  unique (whatsapp_account_id, recipient_digest),
  foreign key (organization_id, whatsapp_account_id)
    references public.whatsapp_accounts(organization_id, id) on delete restrict
);

create table public.whatsapp_message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  whatsapp_account_id uuid not null,
  provider_template_id text,
  name text not null check (name ~ '^[a-z0-9_]{1,512}$'),
  language_code text not null check (language_code ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  category text not null check (category in ('authentication','marketing','utility')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','paused','disabled')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (whatsapp_account_id, name, language_code),
  foreign key (organization_id, whatsapp_account_id)
    references public.whatsapp_accounts(organization_id, id) on delete restrict
);

create table public.organization_retention_settings (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  conversation_days integer check (conversation_days is null or conversation_days between 30 and 3650),
  attachment_days integer check (attachment_days is null or attachment_days between 30 and 3650),
  customer_days integer check (customer_days is null or customer_days between 30 and 3650),
  legal_hold boolean not null default false,
  updated_at timestamptz not null default now()
);

create index whatsapp_suppressions_lookup_idx on public.whatsapp_suppressions(organization_id, whatsapp_account_id, recipient_digest) where is_active;
create index whatsapp_templates_status_idx on public.whatsapp_message_templates(organization_id, whatsapp_account_id, status);

alter table public.whatsapp_suppressions enable row level security;
alter table public.whatsapp_suppressions force row level security;
alter table public.whatsapp_message_templates enable row level security;
alter table public.whatsapp_message_templates force row level security;
alter table public.organization_retention_settings enable row level security;
alter table public.organization_retention_settings force row level security;
revoke all on public.whatsapp_suppressions, public.whatsapp_message_templates, public.organization_retention_settings from public, anon, authenticated;
grant all on public.whatsapp_suppressions, public.whatsapp_message_templates, public.organization_retention_settings to service_role;

create policy whatsapp_suppressions_tenant_select on public.whatsapp_suppressions for select to authenticated
  using (private.is_active_member(organization_id));
create policy whatsapp_templates_tenant_select on public.whatsapp_message_templates for select to authenticated
  using (private.is_active_member(organization_id));
create policy retention_settings_tenant_select on public.organization_retention_settings for select to authenticated
  using (private.is_active_member(organization_id));

create function public.record_whatsapp_opt_out(
  p_organization_id uuid,
  p_whatsapp_account_id uuid,
  p_recipient_digest text,
  p_trace_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_recipient_digest !~ '^[0-9a-f]{64}$' then return false; end if;
  insert into public.whatsapp_suppressions(organization_id, whatsapp_account_id, recipient_digest, reason)
  values(p_organization_id, p_whatsapp_account_id, p_recipient_digest, 'customer_opt_out')
  on conflict (whatsapp_account_id, recipient_digest) do update
    set is_active = true, reason = 'customer_opt_out', revoked_at = null;
  insert into public.audit_events(organization_id, action, entity_type, entity_id, metadata)
  values(p_organization_id, 'whatsapp.customer_opted_out', 'whatsapp_account', p_whatsapp_account_id, jsonb_build_object('trace_id', p_trace_id));
  return true;
end $$;
revoke all on function public.record_whatsapp_opt_out(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_whatsapp_opt_out(uuid, uuid, text, uuid) to service_role;

-- Permit a production connection to receive the round-trip test while pending.
drop function if exists public.resolve_whatsapp_account(text, text, text);
create function public.resolve_whatsapp_account(
  p_phone_number_id text, p_whatsapp_business_account_id text, p_wa_id text
) returns table(organization_id uuid, account_id uuid, mode text, billing_status text, recipient_allowed boolean)
language sql security definer set search_path = '' as $$
  select a.organization_id, a.id, a.mode, a.billing_status,
    case when a.mode = 'production' then true else exists (
      select 1 from public.whatsapp_developer_test_recipients r where r.organization_id=a.organization_id
        and r.whatsapp_account_id=a.id and r.wa_id=p_wa_id and r.is_active
    ) end
  from public.whatsapp_accounts a join public.organizations o on o.id=a.organization_id
  join public.organization_subscriptions s on s.organization_id=a.organization_id
  where a.phone_number_id=p_phone_number_id and a.whatsapp_business_account_id=p_whatsapp_business_account_id
    and a.is_active and a.connection_status in ('connected','test_pending','active','degraded')
    and o.is_active and o.lifecycle_status='active'
    and (s.status='active' or (s.status='trialing' and s.trial_ends_at>now()))
    and (not (s.usage_limits ? 'monthly_whatsapp_messages') or (s.usage_limits->>'monthly_whatsapp_messages') is null
      or ((s.usage_limits->>'monthly_whatsapp_messages') ~ '^[0-9]+$' and
        (select count(*) from public.whatsapp_message_deliveries d where d.organization_id=a.organization_id
          and d.direction='outbound' and d.created_at>=date_trunc('month',now())) < (s.usage_limits->>'monthly_whatsapp_messages')::bigint))
  limit 1
$$;
revoke all on function public.resolve_whatsapp_account(text, text, text) from public, anon, authenticated;
grant execute on function public.resolve_whatsapp_account(text, text, text) to service_role;

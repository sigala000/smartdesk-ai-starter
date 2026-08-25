-- Complete the provider-independent organization profile and subscription
-- controls without introducing a payment processor or commercial terms.
alter table public.organizations
  add column business_address text check (business_address is null or length(btrim(business_address)) between 2 and 500),
  add column country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add column logo_storage_path text check (logo_storage_path is null or logo_storage_path ~ '^[0-9a-f-]{36}/organization/');

alter table public.organization_subscriptions
  add column plan_identifier text not null default 'pilot' check (plan_identifier ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  add column seat_limit integer check (seat_limit is null or seat_limit between 1 and 10000),
  add column usage_limits jsonb not null default '{}'::jsonb check (jsonb_typeof(usage_limits) = 'object'),
  add column grace_ends_at timestamptz,
  add column cancelled_at timestamptz,
  add constraint organization_subscriptions_grace_order_check
    check (grace_ends_at is null or grace_ends_at > trial_started_at);

-- Recreate the trusted lookup to enforce a configured monthly WhatsApp limit.
drop function if exists public.resolve_whatsapp_account(text, text, text);
create function public.resolve_whatsapp_account(
  p_phone_number_id text,
  p_whatsapp_business_account_id text,
  p_wa_id text
) returns table(
  organization_id uuid,
  account_id uuid,
  mode text,
  billing_status text,
  recipient_allowed boolean
)
language sql security definer set search_path = '' as $$
  select a.organization_id, a.id, a.mode, a.billing_status,
    case when a.mode = 'production' then true else exists (
      select 1 from public.whatsapp_developer_test_recipients r
      where r.organization_id = a.organization_id
        and r.whatsapp_account_id = a.id and r.wa_id = p_wa_id and r.is_active
    ) end
  from public.whatsapp_accounts a
  join public.organizations o on o.id = a.organization_id
  join public.organization_subscriptions s on s.organization_id = a.organization_id
  where a.phone_number_id = p_phone_number_id
    and a.whatsapp_business_account_id = p_whatsapp_business_account_id
    and a.is_active and a.connection_status = 'connected'
    and o.is_active and o.lifecycle_status = 'active'
    and (s.status = 'active' or (s.status = 'trialing' and s.trial_ends_at > now()))
    and (
      not (s.usage_limits ? 'monthly_whatsapp_messages')
      or (s.usage_limits->>'monthly_whatsapp_messages') is null
      or (
        (s.usage_limits->>'monthly_whatsapp_messages') ~ '^[0-9]+$'
        and (
          select count(*) from public.whatsapp_message_deliveries d
          where d.organization_id = a.organization_id
            and d.direction = 'outbound'
            and d.created_at >= date_trunc('month', now())
        ) < (s.usage_limits->>'monthly_whatsapp_messages')::bigint
      )
    )
  limit 1
$$;
revoke all on function public.resolve_whatsapp_account(text, text, text) from public, anon, authenticated;
grant execute on function public.resolve_whatsapp_account(text, text, text) to service_role;

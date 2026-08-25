-- Return provider billing state with the trusted destination mapping so the
-- server can fail closed for an account that needs billing attention.
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
language sql
security definer
set search_path = ''
as $$
  select
    a.organization_id,
    a.id,
    a.mode,
    a.billing_status,
    case
      when a.mode = 'production' then true
      else exists (
        select 1
        from public.whatsapp_developer_test_recipients r
        where r.organization_id = a.organization_id
          and r.whatsapp_account_id = a.id
          and r.wa_id = p_wa_id
          and r.is_active
      )
    end
  from public.whatsapp_accounts a
  join public.organizations o on o.id = a.organization_id
  join public.organization_subscriptions s on s.organization_id = a.organization_id
  where a.phone_number_id = p_phone_number_id
    and a.whatsapp_business_account_id = p_whatsapp_business_account_id
    and a.is_active
    and a.connection_status = 'connected'
    and o.is_active
    and o.lifecycle_status = 'active'
    and (s.status = 'active' or (s.status = 'trialing' and s.trial_ends_at > now()))
  limit 1
$$;

revoke all on function public.resolve_whatsapp_account(text, text, text) from public, anon, authenticated;
grant execute on function public.resolve_whatsapp_account(text, text, text) to service_role;

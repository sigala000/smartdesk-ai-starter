-- Require a verified Supabase Auth identity before creating a tenant. This is
-- enforced in the database, not inferred from a browser redirect.
create or replace function public.create_owner_organization(
  p_name text,
  p_slug text,
  p_reference_prefix text,
  p_display_name text,
  p_trial_days integer default 14
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_organization_id uuid;
begin
  if v_user is null or not exists (
    select 1 from auth.users u where u.id=v_user and u.email_confirmed_at is not null
  ) then raise exception using errcode='42501',message='verified_authentication_required'; end if;
  if exists(select 1 from public.organization_members where user_id=v_user) then
    raise exception using errcode='23505',message='membership_exists';
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

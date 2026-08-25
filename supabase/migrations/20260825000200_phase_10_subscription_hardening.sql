-- Avoid casts from administrator-owned JSON when checking web-chat entitlement.
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

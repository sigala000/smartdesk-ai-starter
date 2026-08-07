create function private.member_role(p_organization_id uuid) returns text language sql stable security definer set search_path='' as $$
  select role from public.organization_members where organization_id=p_organization_id and user_id=auth.uid() and is_active limit 1
$$;
create function private.current_member_id(p_organization_id uuid) returns uuid language sql stable security definer set search_path='' as $$
  select id from public.organization_members where organization_id=p_organization_id and user_id=auth.uid() and is_active limit 1
$$;
create function private.is_active_member(p_organization_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=auth.uid() and is_active)
$$;
create function private.is_manager(p_organization_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(private.member_role(p_organization_id) in ('admin','manager'),false)
$$;
create function private.can_access_request(p_organization_id uuid,p_request_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.is_manager(p_organization_id) or exists(
    select 1 from public.requests r join public.organization_members m on m.organization_id=r.organization_id and m.user_id=auth.uid() and m.is_active
    where r.organization_id=p_organization_id and r.id=p_request_id and (
      r.assigned_member_id=m.id or (r.department_id=m.department_id and m.role in ('commercial_officer','technical_officer','project_manager','support_officer'))
    )
  )
$$;
create function private.can_access_conversation(p_organization_id uuid,p_conversation_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.is_manager(p_organization_id) or exists(
    select 1 from public.conversations c where c.organization_id=p_organization_id and c.id=p_conversation_id and (
      c.assigned_member_id=private.current_member_id(p_organization_id) or (c.request_id is not null and private.can_access_request(p_organization_id,c.request_id))
    )
  )
$$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.member_role(uuid) to authenticated;
grant execute on function private.current_member_id(uuid) to authenticated;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.is_manager(uuid) to authenticated;
grant execute on function private.can_access_request(uuid,uuid) to authenticated;
grant execute on function private.can_access_conversation(uuid,uuid) to authenticated;

do $$ declare t text; begin foreach t in array array['organizations','organization_members','departments','services','customers','conversations','messages','requests','request_status_history','assignments','attachments','internal_notes','human_handoffs','knowledge_documents','notifications','feedback','request_reference_counters','audit_events'] loop execute format('alter table public.%I enable row level security',t); execute format('alter table public.%I force row level security',t); end loop; end $$;

create policy organizations_read on public.organizations for select to authenticated using (private.is_active_member(id));
create policy organizations_admin_update on public.organizations for update to authenticated using (private.member_role(id)='admin') with check (private.member_role(id)='admin');

create policy members_read on public.organization_members for select to authenticated using (private.is_active_member(organization_id));
create policy members_admin_insert on public.organization_members for insert to authenticated with check (private.member_role(organization_id)='admin');
create policy members_admin_update on public.organization_members for update to authenticated using (private.member_role(organization_id)='admin') with check (private.member_role(organization_id)='admin');
create policy members_admin_delete on public.organization_members for delete to authenticated using (private.member_role(organization_id)='admin');

do $$ declare t text; begin foreach t in array array['departments','services'] loop
  execute format('create policy %I_read on public.%I for select to authenticated using (private.is_active_member(organization_id))',t,t);
  execute format('create policy %I_admin_insert on public.%I for insert to authenticated with check (private.member_role(organization_id)=''admin'')',t,t);
  execute format('create policy %I_admin_update on public.%I for update to authenticated using (private.member_role(organization_id)=''admin'') with check (private.member_role(organization_id)=''admin'')',t,t);
  execute format('create policy %I_admin_delete on public.%I for delete to authenticated using (private.member_role(organization_id)=''admin'')',t,t);
end loop; end $$;

create policy customers_manager_read on public.customers for select to authenticated using (private.is_manager(organization_id));
create policy customers_manager_write on public.customers for all to authenticated using (private.is_manager(organization_id)) with check (private.is_manager(organization_id));
create policy conversations_read on public.conversations for select to authenticated using (private.can_access_conversation(organization_id,id));
create policy conversations_manager_write on public.conversations for all to authenticated using (private.is_manager(organization_id)) with check (private.is_manager(organization_id));
create policy messages_read on public.messages for select to authenticated using (private.can_access_conversation(organization_id,conversation_id));
create policy messages_manager_write on public.messages for all to authenticated using (private.is_manager(organization_id)) with check (private.is_manager(organization_id));
create policy requests_read on public.requests for select to authenticated using (private.can_access_request(organization_id,id));
create policy requests_manager_write on public.requests for all to authenticated using (private.is_manager(organization_id)) with check (private.is_manager(organization_id));

do $$ declare t text; begin foreach t in array array['request_status_history','assignments','attachments','internal_notes','human_handoffs','feedback','audit_events'] loop
  execute format('create policy %I_manager_all on public.%I for all to authenticated using (private.is_manager(organization_id)) with check (private.is_manager(organization_id))',t,t);
end loop; end $$;
create policy history_request_read on public.request_status_history for select to authenticated using (private.can_access_request(organization_id,request_id));
create policy assignments_request_read on public.assignments for select to authenticated using (private.can_access_request(organization_id,request_id));
create policy attachments_request_read on public.attachments for select to authenticated using (request_id is not null and private.can_access_request(organization_id,request_id));
create policy notes_request_read on public.internal_notes for select to authenticated using (private.can_access_request(organization_id,request_id));
create policy handoffs_conversation_read on public.human_handoffs for select to authenticated using (private.can_access_conversation(organization_id,conversation_id));
create policy feedback_request_read on public.feedback for select to authenticated using (private.can_access_request(organization_id,request_id));

create policy knowledge_read on public.knowledge_documents for select to authenticated using (private.is_active_member(organization_id) and status='approved');
create policy knowledge_manager_write on public.knowledge_documents for all to authenticated using (private.is_manager(organization_id)) with check (private.is_manager(organization_id));
create policy notifications_own_read on public.notifications for select to authenticated using (recipient_member_id=private.current_member_id(organization_id));
create policy notifications_own_update on public.notifications for update to authenticated using (recipient_member_id=private.current_member_id(organization_id)) with check (recipient_member_id=private.current_member_id(organization_id));
create policy notifications_manager_insert on public.notifications for insert to authenticated with check (private.is_manager(organization_id));

create trigger requests_record_status after insert or update of status on public.requests for each row execute function private.record_request_status_change();

-- Phase 3 authenticated employee request-management boundary.

alter table public.assignments add column department_id uuid;
alter table public.assignments add column reason text;
alter table public.assignments
  add constraint assignments_department_fk foreign key (organization_id, department_id)
  references public.departments(organization_id, id) on delete restrict;

update public.assignments a
set department_id = coalesce(m.department_id, r.department_id)
from public.requests r, public.organization_members m
where r.organization_id = a.organization_id and r.id = a.request_id
  and m.organization_id = a.organization_id and m.id = a.member_id;

alter table public.assignments alter column member_id drop not null;
alter table public.assignments add constraint assignments_target_check
  check (department_id is not null or member_id is not null);
alter table public.assignments add constraint assignments_reason_length_check
  check (reason is null or length(btrim(reason)) between 1 and 500);

alter table public.request_status_history
  add column changed_by_type text not null default 'system'
    check (changed_by_type in ('system', 'employee', 'customer')),
  add column source text not null default 'database'
    check (source in ('database', 'employee_dashboard', 'public_conversation', 'system'));
alter table public.request_status_history add constraint request_status_history_reason_length_check
  check (reason is null or length(btrim(reason)) between 1 and 500);
alter table public.internal_notes add constraint internal_notes_content_length_check
  check (length(content) <= 4000);

create index requests_cursor_idx on public.requests(organization_id, created_at desc, id desc);
create index assignments_request_timeline_idx on public.assignments(organization_id, request_id, assigned_at desc, id desc);
create index request_status_history_timeline_idx on public.request_status_history(organization_id, request_id, created_at desc, id desc);

create or replace function private.is_active_member(p_organization_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id and o.is_active
    where m.organization_id = p_organization_id and m.user_id = auth.uid() and m.is_active
  )
$$;

create or replace function private.can_access_request(p_organization_id uuid, p_request_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_manager(p_organization_id) or exists(
    select 1
    from public.requests r
    join public.organization_members m
      on m.organization_id = r.organization_id
      and m.user_id = auth.uid()
      and m.is_active
      and m.role in ('commercial_officer', 'technical_officer', 'project_manager', 'support_officer')
    where r.organization_id = p_organization_id and r.id = p_request_id
      and (r.assigned_member_id = m.id or (m.department_id is not null and r.department_id = m.department_id))
  )
$$;

create or replace function private.record_request_status_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(current_setting('smartdesk.status_reason', true), '');
  v_source text := coalesce(nullif(current_setting('smartdesk.status_source', true), ''), 'database');
  v_actor uuid := private.current_member_id(new.organization_id);
begin
  if tg_op = 'INSERT' then
    insert into public.request_status_history(
      organization_id, request_id, to_status, changed_by_member_id, changed_by_type, source
    ) values (
      new.organization_id, new.id, new.status, v_actor,
      case when v_actor is null then 'system' else 'employee' end, v_source
    );
  elsif new.status is distinct from old.status then
    insert into public.request_status_history(
      organization_id, request_id, from_status, to_status, changed_by_member_id, reason, changed_by_type, source
    ) values (
      new.organization_id, new.id, old.status, new.status, v_actor, v_reason,
      case when v_actor is null then 'system' else 'employee' end, v_source
    );
  end if;
  return new;
end $$;

drop policy if exists requests_manager_write on public.requests;
drop policy if exists assignments_manager_all on public.assignments;
drop policy if exists internal_notes_manager_all on public.internal_notes;
drop policy if exists notes_request_read on public.internal_notes;
drop policy if exists messages_manager_write on public.messages;

create policy customers_request_read on public.customers for select to authenticated using (
  private.is_active_member(organization_id)
  and exists (
    select 1 from public.requests r
    where r.organization_id = customers.organization_id
      and r.customer_id = customers.id
      and private.can_access_request(r.organization_id, r.id)
  )
);

create policy notes_authorized_read on public.internal_notes for select to authenticated using (
  private.can_access_request(organization_id, request_id)
  and private.member_role(organization_id) <> 'viewer'
);

revoke insert, update, delete on public.requests from authenticated;
revoke insert, update, delete on public.assignments from authenticated;
revoke insert, update, delete on public.request_status_history from authenticated;
revoke insert, update, delete on public.internal_notes from authenticated;
revoke insert, update, delete on public.messages from authenticated;
revoke insert, update, delete on public.audit_events from authenticated;

create function private.valid_request_transition(p_from text, p_to text) returns boolean
language sql immutable set search_path = '' as $$
  select case p_from
    when 'draft' then p_to = 'new'
    when 'new' then p_to in ('awaiting_customer_information', 'awaiting_assessment', 'cancelled', 'unsupported')
    when 'awaiting_customer_information' then p_to in ('new', 'inactive', 'cancelled')
    when 'awaiting_assessment' then p_to in ('site_visit_proposed', 'assessment_completed', 'awaiting_customer_information', 'cancelled', 'unsupported')
    when 'site_visit_proposed' then p_to in ('site_visit_scheduled', 'cancelled')
    when 'site_visit_scheduled' then p_to in ('assessment_completed', 'cancelled')
    when 'assessment_completed' then p_to in ('quotation_preparing', 'cancelled')
    when 'quotation_preparing' then p_to in ('quotation_sent', 'cancelled')
    when 'quotation_sent' then p_to in ('quotation_revision_requested', 'quotation_accepted', 'quotation_rejected', 'cancelled')
    when 'quotation_revision_requested' then p_to in ('quotation_preparing', 'cancelled')
    when 'quotation_accepted' then p_to in ('scheduled', 'cancelled')
    when 'quotation_rejected' then p_to = 'closed'
    when 'scheduled' then p_to in ('in_progress', 'cancelled')
    when 'in_progress' then p_to in ('awaiting_client_validation', 'cancelled')
    when 'awaiting_client_validation' then p_to in ('completed', 'in_progress', 'cancelled')
    when 'completed' then p_to = 'closed'
    when 'unsupported' then p_to = 'closed'
    when 'inactive' then p_to in ('new', 'cancelled')
    else false
  end
$$;
revoke all on function private.valid_request_transition(text, text) from public, anon, authenticated;

create function public.assign_request(
  p_request_id uuid,
  p_department_id uuid,
  p_member_id uuid,
  p_reason text,
  p_expected_updated_at timestamptz
) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.requests;
  v_actor public.organization_members;
  v_member public.organization_members;
  v_department public.departments;
begin
  select * into v_request from public.requests where id = p_request_id for update;
  if v_request.id is null or not private.can_access_request(v_request.organization_id, v_request.id) then
    raise exception using errcode = 'P0002', message = 'request_not_found';
  end if;
  select * into v_actor from public.organization_members
    where organization_id = v_request.organization_id and user_id = auth.uid() and is_active;
  if v_actor.id is null or v_actor.role not in ('admin', 'manager', 'commercial_officer') then
    raise exception using errcode = '42501', message = 'assignment_forbidden';
  end if;
  if v_request.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'stale_request';
  end if;
  if p_department_id is null and p_member_id is null then
    raise exception using errcode = '22023', message = 'assignment_target_required';
  end if;
  if p_reason is not null and length(btrim(p_reason)) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'invalid_reason';
  end if;
  if p_department_id is not null then
    select * into v_department from public.departments
      where organization_id = v_request.organization_id and id = p_department_id and is_active;
    if v_department.id is null then
      raise exception using errcode = '22023', message = 'invalid_department';
    end if;
  end if;
  if p_member_id is not null then
    select * into v_member from public.organization_members
      where organization_id = v_request.organization_id and id = p_member_id and is_active
        and role in ('admin', 'manager', 'commercial_officer', 'technical_officer', 'project_manager', 'support_officer');
    if v_member.id is null then
      raise exception using errcode = '22023', message = 'invalid_member';
    end if;
    if p_department_id is not null and v_member.department_id is distinct from p_department_id then
      raise exception using errcode = '22023', message = 'member_department_mismatch';
    end if;
    if p_department_id is null then
      p_department_id := v_member.department_id;
    end if;
  end if;
  if v_request.department_id is not distinct from p_department_id
    and v_request.assigned_member_id is not distinct from p_member_id then
    return v_request;
  end if;

  update public.assignments set unassigned_at = now()
    where organization_id = v_request.organization_id and request_id = v_request.id and unassigned_at is null;
  insert into public.assignments(
    organization_id, request_id, department_id, member_id, assigned_by_member_id, reason
  ) values (
    v_request.organization_id, v_request.id, p_department_id, p_member_id, v_actor.id, nullif(btrim(p_reason), '')
  );
  update public.requests set department_id = p_department_id, assigned_member_id = p_member_id
    where organization_id = v_request.organization_id and id = v_request.id returning * into v_request;
  insert into public.audit_events(organization_id, actor_member_id, action, entity_type, entity_id, metadata)
    values (v_request.organization_id, v_actor.id, 'request.assignment_changed', 'request', v_request.id,
      jsonb_build_object('department_id', p_department_id, 'member_id', p_member_id));
  return v_request;
end $$;

create function public.transition_request_status(
  p_request_id uuid,
  p_new_status text,
  p_reason text,
  p_expected_updated_at timestamptz
) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.requests;
  v_actor public.organization_members;
begin
  select * into v_request from public.requests where id = p_request_id for update;
  if v_request.id is null or not private.can_access_request(v_request.organization_id, v_request.id) then
    raise exception using errcode = 'P0002', message = 'request_not_found';
  end if;
  select * into v_actor from public.organization_members
    where organization_id = v_request.organization_id and user_id = auth.uid() and is_active;
  if v_actor.id is null or v_actor.role = 'viewer' then
    raise exception using errcode = '42501', message = 'transition_forbidden';
  end if;
  if v_request.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'stale_request';
  end if;
  if not private.valid_request_transition(v_request.status, p_new_status) then
    raise exception using errcode = '23514', message = 'invalid_transition';
  end if;
  if (v_request.status, p_new_status) not in (
    ('new','awaiting_customer_information'), ('new','awaiting_assessment'),
    ('new','unsupported'), ('new','cancelled'),
    ('awaiting_customer_information','new'), ('awaiting_customer_information','inactive'),
    ('awaiting_customer_information','cancelled'),
    ('awaiting_assessment','awaiting_customer_information'),
    ('awaiting_assessment','unsupported'), ('awaiting_assessment','cancelled'),
    ('unsupported','closed'), ('inactive','new'), ('inactive','cancelled')
  ) then
    raise exception using errcode = '23514', message = 'transition_prerequisite_unavailable';
  end if;
  if v_actor.role not in ('admin', 'manager', 'commercial_officer', 'support_officer') then
    raise exception using errcode = '42501', message = 'transition_forbidden';
  end if;
  if v_actor.role = 'support_officer' and (
    v_request.request_type not in ('support', 'complaint') or
    (v_request.status, p_new_status) not in (
      ('new','awaiting_customer_information'), ('new','cancelled'),
      ('awaiting_customer_information','new'), ('awaiting_customer_information','inactive'),
      ('awaiting_customer_information','cancelled'),
      ('awaiting_assessment','awaiting_customer_information'),
      ('awaiting_assessment','unsupported'), ('awaiting_assessment','cancelled'),
      ('unsupported','closed'), ('inactive','new'), ('inactive','cancelled')
    )
  ) then
    raise exception using errcode = '42501', message = 'transition_forbidden';
  end if;
  if p_new_status = 'cancelled' and (p_reason is null or length(btrim(p_reason)) = 0) then
    raise exception using errcode = '22023', message = 'cancellation_reason_required';
  end if;
  if p_reason is not null and length(btrim(p_reason)) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'invalid_reason';
  end if;
  perform set_config('smartdesk.status_reason', coalesce(nullif(btrim(p_reason), ''), ''), true);
  perform set_config('smartdesk.status_source', 'employee_dashboard', true);
  update public.requests set status = p_new_status
    where organization_id = v_request.organization_id and id = v_request.id returning * into v_request;
  insert into public.audit_events(organization_id, actor_member_id, action, entity_type, entity_id, metadata)
    values (v_request.organization_id, v_actor.id, 'request.status_changed', 'request', v_request.id,
      jsonb_build_object('new_status', p_new_status));
  return v_request;
end $$;

create function public.add_internal_note(p_request_id uuid, p_content text) returns public.internal_notes
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.requests;
  v_actor public.organization_members;
  v_note public.internal_notes;
begin
  select * into v_request from public.requests where id = p_request_id;
  if v_request.id is null or not private.can_access_request(v_request.organization_id, v_request.id) then
    raise exception using errcode = 'P0002', message = 'request_not_found';
  end if;
  select * into v_actor from public.organization_members
    where organization_id = v_request.organization_id and user_id = auth.uid() and is_active;
  if v_actor.id is null or v_actor.role = 'viewer' then
    raise exception using errcode = '42501', message = 'notes_forbidden';
  end if;
  if length(btrim(p_content)) not between 1 and 4000 then
    raise exception using errcode = '22023', message = 'invalid_note';
  end if;
  insert into public.internal_notes(organization_id, request_id, author_member_id, content)
    values (v_request.organization_id, v_request.id, v_actor.id, btrim(p_content)) returning * into v_note;
  insert into public.audit_events(organization_id, actor_member_id, action, entity_type, entity_id)
    values (v_request.organization_id, v_actor.id, 'request.internal_note_added', 'request', v_request.id);
  return v_note;
end $$;

create function public.request_more_information(
  p_request_id uuid,
  p_question text,
  p_expected_updated_at timestamptz
) returns public.requests
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.requests;
  v_conversation public.conversations;
  v_actor public.organization_members;
  v_status_changed boolean := false;
begin
  select * into v_request from public.requests where id = p_request_id for update;
  if v_request.id is null or not private.can_access_request(v_request.organization_id, v_request.id) then
    raise exception using errcode = 'P0002', message = 'request_not_found';
  end if;
  select * into v_actor from public.organization_members
    where organization_id = v_request.organization_id and user_id = auth.uid() and is_active;
  if v_actor.id is null or v_actor.role = 'viewer' then
    raise exception using errcode = '42501', message = 'request_information_forbidden';
  end if;
  if v_request.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'stale_request';
  end if;
  if length(btrim(p_question)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'invalid_question';
  end if;
  select * into v_conversation from public.conversations
    where organization_id = v_request.organization_id and id = v_request.conversation_id
      and state not in ('resolved', 'closed') for update;
  if v_conversation.id is null then
    raise exception using errcode = '23514', message = 'conversation_required';
  end if;
  if v_request.status <> 'awaiting_customer_information'
    and not private.valid_request_transition(v_request.status, 'awaiting_customer_information') then
    raise exception using errcode = '23514', message = 'invalid_transition';
  end if;
  insert into public.messages(organization_id, conversation_id, sender_type, sender_member_id, content)
    values (v_request.organization_id, v_conversation.id, 'employee', v_actor.id, btrim(p_question));
  if v_request.status <> 'awaiting_customer_information' then
    perform set_config('smartdesk.status_reason', 'Additional customer information requested', true);
    perform set_config('smartdesk.status_source', 'employee_dashboard', true);
    update public.requests set status = 'awaiting_customer_information'
      where organization_id = v_request.organization_id and id = v_request.id returning * into v_request;
    v_status_changed := true;
  end if;
  if v_status_changed then
    insert into public.audit_events(organization_id, actor_member_id, action, entity_type, entity_id, metadata)
      values (v_request.organization_id, v_actor.id, 'request.status_changed', 'request', v_request.id,
        jsonb_build_object('new_status', 'awaiting_customer_information'));
  end if;
  insert into public.audit_events(organization_id, actor_member_id, action, entity_type, entity_id)
    values (v_request.organization_id, v_actor.id, 'request.information_requested', 'request', v_request.id);
  return v_request;
end $$;

revoke all on function public.assign_request(uuid, uuid, uuid, text, timestamptz) from public, anon;
revoke all on function public.transition_request_status(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.add_internal_note(uuid, text) from public, anon;
revoke all on function public.request_more_information(uuid, text, timestamptz) from public, anon;
grant execute on function public.assign_request(uuid, uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.transition_request_status(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.add_internal_note(uuid, text) to authenticated;
grant execute on function public.request_more_information(uuid, text, timestamptz) to authenticated;

revoke all on function private.is_active_member(uuid) from public, anon, authenticated;
revoke all on function private.can_access_request(uuid, uuid) from public, anon, authenticated;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.can_access_request(uuid, uuid) to authenticated;

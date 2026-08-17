-- Phase 7: transaction-safe human handoff, ownership and customer follow-up.

alter table public.human_handoffs
  add column reason_code text not null default 'explicit_human_request',
  add column idempotency_key uuid not null default gen_random_uuid(),
  add column queued_at timestamptz,
  add column assigned_at timestamptz,
  add column activated_at timestamptz,
  add column cancelled_at timestamptz,
  add column resolution text,
  add column resume_automation boolean;

alter table public.human_handoffs
  add constraint human_handoffs_reason_code_check check (reason_code in ('explicit_human_request','safety_concern','suspected_fraud','payment_dispute','serious_complaint','unsupported_information')),
  add constraint human_handoffs_reason_length_check check (length(btrim(reason)) between 3 and 500),
  add constraint human_handoffs_resolution_check check (resolution is null or length(btrim(resolution)) between 3 and 1000),
  add constraint human_handoffs_lifecycle_check check (
    (status <> 'queued' or queued_at is not null) and
    (status not in ('assigned','active') or assigned_member_id is not null) and
    (status <> 'assigned' or assigned_at is not null) and
    (status <> 'active' or activated_at is not null) and
    (status <> 'cancelled' or cancelled_at is not null) and
    (status <> 'resolved' or (resolved_at is not null and resolution is not null and resume_automation is not null))
  );

create unique index human_handoffs_idempotency_idx on public.human_handoffs(organization_id,conversation_id,idempotency_key);
create unique index human_handoffs_one_open_per_conversation_idx on public.human_handoffs(organization_id,conversation_id) where status in ('requested','queued','assigned','active');
create index human_handoffs_employee_queue_idx on public.human_handoffs(organization_id,priority desc,requested_at,id) where status in ('queued','assigned','active');

create function private.handoff_actor(p_organization_id uuid)
returns public.organization_members language sql stable security definer set search_path = '' as $$
  select m from public.organization_members m
  where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.is_active limit 1
$$;

create function private.can_manage_handoff(p_organization_id uuid, p_handoff_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.human_handoffs h
    join public.organization_members m on m.organization_id=h.organization_id and m.user_id=auth.uid() and m.is_active
    where h.organization_id=p_organization_id and h.id=p_handoff_id and m.role <> 'viewer'
      and (m.role in ('admin','manager','support_officer') or h.assigned_member_id=m.id or private.can_access_conversation(h.organization_id,h.conversation_id))
  )
$$;

revoke all on function private.handoff_actor(uuid) from public,anon,authenticated;
revoke all on function private.can_manage_handoff(uuid,uuid) from public,anon,authenticated;
grant execute on function private.can_manage_handoff(uuid,uuid) to authenticated;

drop policy if exists human_handoffs_manager_all on public.human_handoffs;
drop policy if exists handoffs_conversation_read on public.human_handoffs;
create policy handoffs_authorized_read on public.human_handoffs for select to authenticated
using (private.can_manage_handoff(organization_id,id));
revoke insert,update,delete on public.human_handoffs from authenticated;

create function public.request_public_handoff(
  p_conversation_id uuid, p_token_digest text, p_idempotency_key uuid,
  p_reason text, p_reason_code text, p_priority text
) returns public.human_handoffs
language plpgsql security definer set search_path='' as $$
declare v_conversation public.conversations; v_handoff public.human_handoffs;
begin
  if length(btrim(p_reason)) not between 3 and 500 or p_priority not in ('normal','high','urgent')
     or p_reason_code not in ('explicit_human_request','safety_concern','suspected_fraud','payment_dispute','serious_complaint','unsupported_information') then
    raise exception using errcode='22023',message='invalid_handoff';
  end if;
  select c.* into v_conversation from public.conversations c
  join public.public_conversation_access a on a.organization_id=c.organization_id and a.conversation_id=c.id
  where c.id=p_conversation_id and a.token_digest=p_token_digest and a.revoked_at is null
    and a.read_disabled_at is null and a.expires_at>now() for update of c;
  if v_conversation.id is null then raise exception using errcode='P0002',message='conversation_not_found'; end if;

  select * into v_handoff from public.human_handoffs
    where organization_id=v_conversation.organization_id and conversation_id=v_conversation.id
      and idempotency_key=p_idempotency_key for update;
  if v_handoff.id is not null then return v_handoff; end if;

  select * into v_handoff from public.human_handoffs
    where organization_id=v_conversation.organization_id and conversation_id=v_conversation.id
      and status in ('requested','queued','assigned','active') for update;
  if v_handoff.id is null then
    insert into public.human_handoffs(organization_id,conversation_id,request_id,status,priority,reason,reason_code,idempotency_key,queued_at)
    values(v_conversation.organization_id,v_conversation.id,v_conversation.request_id,'queued',p_priority,btrim(p_reason),p_reason_code,p_idempotency_key,now()) returning * into v_handoff;
    update public.conversations set state='human_handoff',updated_at=now() where organization_id=v_conversation.organization_id and id=v_conversation.id;
    insert into public.audit_events(organization_id,action,entity_type,entity_id,metadata)
      values(v_conversation.organization_id,'handoff.queued','human_handoff',v_handoff.id,jsonb_build_object('priority',p_priority,'reason_code',p_reason_code));
    insert into public.notifications(organization_id,recipient_member_id,request_id,kind,title,body)
      select v_conversation.organization_id,m.id,v_conversation.request_id,'handoff_queued','Customer needs human support','A customer conversation was added to the human handoff queue.'
      from public.organization_members m where m.organization_id=v_conversation.organization_id and m.is_active and m.role in ('admin','manager','support_officer');
  elsif (case v_handoff.priority when 'urgent' then 3 when 'high' then 2 else 1 end) < (case p_priority when 'urgent' then 3 when 'high' then 2 else 1 end) then
    update public.human_handoffs set priority=p_priority,updated_at=now() where id=v_handoff.id returning * into v_handoff;
    insert into public.audit_events(organization_id,action,entity_type,entity_id,metadata)
      values(v_conversation.organization_id,'handoff.priority_elevated','human_handoff',v_handoff.id,jsonb_build_object('priority',p_priority));
  end if;
  return v_handoff;
end $$;

create function public.assign_handoff(p_handoff_id uuid,p_member_id uuid)
returns public.human_handoffs language plpgsql security definer set search_path='' as $$
declare v_h public.human_handoffs; v_actor public.organization_members; v_target public.organization_members;
begin
 select * into v_h from public.human_handoffs where id=p_handoff_id;
 if v_h.id is not null then perform 1 from public.conversations where organization_id=v_h.organization_id and id=v_h.conversation_id for update; end if;
 select * into v_h from public.human_handoffs where id=p_handoff_id for update;
 if v_h.id is null or not private.can_manage_handoff(v_h.organization_id,v_h.id) then raise exception using errcode='P0002',message='handoff_not_found'; end if;
 select * into v_actor from private.handoff_actor(v_h.organization_id);
 select * into v_target from public.organization_members where organization_id=v_h.organization_id and id=p_member_id and is_active;
 if v_target.id is null or v_target.role='viewer' then raise exception using errcode='23514',message='invalid_member'; end if;
 if v_actor.role not in ('admin','manager') and not (v_actor.role='support_officer' and (v_target.id=v_actor.id or v_target.department_id=v_actor.department_id)) then raise exception using errcode='42501',message='handoff_assignment_forbidden'; end if;
 if v_h.status not in ('queued','assigned') then raise exception using errcode='23514',message='invalid_handoff_transition'; end if;
 update public.human_handoffs set status='assigned',assigned_member_id=v_target.id,assigned_at=now(),updated_at=now() where id=v_h.id returning * into v_h;
 update public.conversations set assigned_member_id=v_target.id,state='human_handoff',updated_at=now() where organization_id=v_h.organization_id and id=v_h.conversation_id;
 insert into public.audit_events(organization_id,actor_member_id,action,entity_type,entity_id,metadata) values(v_h.organization_id,v_actor.id,'handoff.assigned','human_handoff',v_h.id,jsonb_build_object('member_id',v_target.id));
 return v_h;
end $$;

create function public.join_handoff(p_handoff_id uuid)
returns public.human_handoffs language plpgsql security definer set search_path='' as $$
declare v_h public.human_handoffs; v_actor public.organization_members;
begin
 select * into v_h from public.human_handoffs where id=p_handoff_id;
 if v_h.id is not null then perform 1 from public.conversations where organization_id=v_h.organization_id and id=v_h.conversation_id for update; end if;
 select * into v_h from public.human_handoffs where id=p_handoff_id for update;
 if v_h.id is null or not private.can_manage_handoff(v_h.organization_id,v_h.id) then raise exception using errcode='P0002',message='handoff_not_found'; end if;
 select * into v_actor from private.handoff_actor(v_h.organization_id);
 if v_h.status='active' and v_h.assigned_member_id=v_actor.id then return v_h; end if;
 if v_h.status<>'assigned' or (v_h.assigned_member_id<>v_actor.id and v_actor.role not in ('admin','manager')) then raise exception using errcode='40001',message='handoff_ownership_conflict'; end if;
 update public.human_handoffs set status='active',assigned_member_id=v_actor.id,assigned_at=coalesce(assigned_at,now()),activated_at=now(),updated_at=now() where id=v_h.id returning * into v_h;
 update public.conversations set assigned_member_id=v_actor.id,state='human_handoff',updated_at=now() where organization_id=v_h.organization_id and id=v_h.conversation_id;
 insert into public.audit_events(organization_id,actor_member_id,action,entity_type,entity_id) values(v_h.organization_id,v_actor.id,'handoff.activated','human_handoff',v_h.id);
 return v_h;
end $$;

create function public.send_handoff_message(p_handoff_id uuid,p_client_message_id uuid,p_content text)
returns public.messages language plpgsql security definer set search_path='' as $$
declare v_h public.human_handoffs; v_actor public.organization_members; v_message public.messages;
begin
 select * into v_h from public.human_handoffs where id=p_handoff_id;
 if v_h.id is not null then perform 1 from public.conversations where organization_id=v_h.organization_id and id=v_h.conversation_id for update; end if;
 select * into v_h from public.human_handoffs where id=p_handoff_id for update;
 if v_h.id is null or not private.can_manage_handoff(v_h.organization_id,v_h.id) then raise exception using errcode='P0002',message='handoff_not_found'; end if;
 select * into v_actor from private.handoff_actor(v_h.organization_id);
 if v_h.status<>'active' or (v_h.assigned_member_id<>v_actor.id and v_actor.role not in ('admin','manager')) then raise exception using errcode='42501',message='handoff_not_active_owner'; end if;
 if length(btrim(p_content)) not between 1 and 2000 then raise exception using errcode='22023',message='invalid_message'; end if;
 select * into v_message from public.messages where organization_id=v_h.organization_id and conversation_id=v_h.conversation_id and metadata->>'employee_client_message_id'=p_client_message_id::text;
 if v_message.id is null then
  insert into public.messages(organization_id,conversation_id,sender_type,sender_member_id,content,metadata) values(v_h.organization_id,v_h.conversation_id,'employee',v_actor.id,btrim(p_content),jsonb_build_object('employee_client_message_id',p_client_message_id,'handoff_id',v_h.id,'request_id',v_h.request_id)) returning * into v_message;
  insert into public.audit_events(organization_id,actor_member_id,action,entity_type,entity_id,metadata) values(v_h.organization_id,v_actor.id,'handoff.employee_message_sent','human_handoff',v_h.id,jsonb_build_object('message_id',v_message.id));
 end if;
 return v_message;
end $$;

create function public.resolve_handoff(p_handoff_id uuid,p_resolution text,p_resume_automation boolean)
returns public.human_handoffs language plpgsql security definer set search_path='' as $$
declare v_h public.human_handoffs; v_actor public.organization_members; v_next_state text; v_draft_stage text; v_request_status text;
begin
 select * into v_h from public.human_handoffs where id=p_handoff_id;
 if v_h.id is not null then perform 1 from public.conversations where organization_id=v_h.organization_id and id=v_h.conversation_id for update; end if;
 select * into v_h from public.human_handoffs where id=p_handoff_id for update;
 if v_h.id is null or not private.can_manage_handoff(v_h.organization_id,v_h.id) then raise exception using errcode='P0002',message='handoff_not_found'; end if;
 select * into v_actor from private.handoff_actor(v_h.organization_id);
 if v_h.status<>'active' or (v_h.assigned_member_id<>v_actor.id and v_actor.role not in ('admin','manager')) then raise exception using errcode='42501',message='handoff_not_active_owner'; end if;
 if length(btrim(p_resolution)) not between 3 and 1000 then raise exception using errcode='22023',message='invalid_resolution'; end if;
 v_next_state:='resolved';
 if p_resume_automation then
  select stage into v_draft_stage from public.conversation_drafts where organization_id=v_h.organization_id and conversation_id=v_h.conversation_id;
  if v_h.request_id is not null then
   select status into v_request_status from public.requests where organization_id=v_h.organization_id and id=v_h.request_id for update;
  end if;
  if v_draft_stage='cancelled' or v_request_status in ('completed','cancelled','unsupported','inactive','closed') then
   raise exception using errcode='23514',message='invalid_resume_state';
  end if;
  v_next_state:=case when v_request_status='awaiting_customer_information' then 'awaiting_customer' else 'open' end;
 end if;
 update public.human_handoffs set status='resolved',resolution=btrim(p_resolution),resume_automation=p_resume_automation,resolved_at=now(),updated_at=now() where id=v_h.id returning * into v_h;
 update public.conversations set assigned_member_id=null,state=v_next_state,updated_at=now() where organization_id=v_h.organization_id and id=v_h.conversation_id;
 insert into public.audit_events(organization_id,actor_member_id,action,entity_type,entity_id,metadata) values(v_h.organization_id,v_actor.id,'handoff.resolved','human_handoff',v_h.id,jsonb_build_object('resume_automation',p_resume_automation));
 return v_h;
end $$;

revoke all on function public.request_public_handoff(uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.request_public_handoff(uuid,text,uuid,text,text,text) to service_role;

create function public.record_handoff_customer_message(
  p_conversation_id uuid,p_token_digest text,p_client_message_id uuid,p_content text
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_conversation public.conversations; v_h public.human_handoffs; v_message public.messages; v_request public.requests;
begin
 if length(btrim(p_content)) not between 1 and 2000 then raise exception using errcode='22023',message='invalid_message'; end if;
 select c.* into v_conversation from public.conversations c join public.public_conversation_access a on a.organization_id=c.organization_id and a.conversation_id=c.id
 where c.id=p_conversation_id and a.token_digest=p_token_digest and a.revoked_at is null and a.read_disabled_at is null and a.expires_at>now() for update of c;
 if v_conversation.id is null then raise exception using errcode='P0002',message='conversation_not_found'; end if;
 select * into v_h from public.human_handoffs where organization_id=v_conversation.organization_id and conversation_id=v_conversation.id and status in ('requested','queued','assigned','active') for update;
 if v_h.id is null then return false; end if;
 select * into v_message from public.messages where organization_id=v_conversation.organization_id and conversation_id=v_conversation.id and client_message_id=p_client_message_id;
 if v_message.id is null then
  insert into public.messages(organization_id,conversation_id,sender_type,client_message_id,content,metadata) values(v_conversation.organization_id,v_conversation.id,'customer',p_client_message_id,btrim(p_content),jsonb_build_object('handoff_id',v_h.id,'request_id',v_conversation.request_id,'message_kind','handoff_customer_message')) returning * into v_message;
  if v_h.assigned_member_id is not null then
   insert into public.notifications(organization_id,recipient_member_id,request_id,kind,title,body) values(v_h.organization_id,v_h.assigned_member_id,v_h.request_id,'handoff_customer_reply','Customer replied','A customer replied to a human-support conversation.');
  end if;
  if v_conversation.request_id is not null then
   select * into v_request from public.requests where organization_id=v_conversation.organization_id and id=v_conversation.request_id for update;
   if v_request.status='awaiting_customer_information' then
    perform set_config('smartdesk.status_reason','Customer supplied requested information',true); perform set_config('smartdesk.status_source','public_conversation',true);
    update public.requests set status='new' where organization_id=v_request.organization_id and id=v_request.id;
    insert into public.audit_events(organization_id,action,entity_type,entity_id,metadata) values(v_request.organization_id,'request.customer_information_received','request',v_request.id,jsonb_build_object('message_id',v_message.id));
   end if;
  end if;
  insert into public.audit_events(organization_id,action,entity_type,entity_id,metadata) values(v_h.organization_id,'handoff.customer_message_received','human_handoff',v_h.id,jsonb_build_object('message_id',v_message.id));
 end if;
 return true;
end $$;
revoke all on function public.record_handoff_customer_message(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.record_handoff_customer_message(uuid,text,uuid,text) to service_role;

create function public.record_public_request_follow_up(
  p_conversation_id uuid,p_token_digest text,p_client_message_id uuid,p_content text
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_conversation public.conversations; v_request public.requests; v_message public.messages;
begin
 if length(btrim(p_content)) not between 1 and 2000 then raise exception using errcode='22023',message='invalid_message'; end if;
 select c.* into v_conversation from public.conversations c join public.public_conversation_access a on a.organization_id=c.organization_id and a.conversation_id=c.id
 where c.id=p_conversation_id and a.token_digest=p_token_digest and a.revoked_at is null and a.read_disabled_at is null and a.expires_at>now() for update of c;
 if v_conversation.id is null then raise exception using errcode='P0002',message='conversation_not_found'; end if;
 if v_conversation.request_id is null then return false; end if;
 select * into v_request from public.requests where organization_id=v_conversation.organization_id and id=v_conversation.request_id for update;
 if v_request.status<>'awaiting_customer_information' then return false; end if;
 select * into v_message from public.messages where organization_id=v_conversation.organization_id and conversation_id=v_conversation.id and client_message_id=p_client_message_id;
 if v_message.id is null then
  insert into public.messages(organization_id,conversation_id,sender_type,client_message_id,content,metadata) values(v_conversation.organization_id,v_conversation.id,'customer',p_client_message_id,btrim(p_content),jsonb_build_object('request_id',v_request.id,'message_kind','request_information_response')) returning * into v_message;
  perform set_config('smartdesk.status_reason','Customer supplied requested information',true); perform set_config('smartdesk.status_source','public_conversation',true);
  update public.requests set status='new' where organization_id=v_request.organization_id and id=v_request.id;
  update public.conversations set state='open',updated_at=now() where organization_id=v_conversation.organization_id and id=v_conversation.id and state='awaiting_customer';
  if v_request.assigned_member_id is not null then insert into public.notifications(organization_id,recipient_member_id,request_id,kind,title,body) values(v_request.organization_id,v_request.assigned_member_id,v_request.id,'request_information_response','Customer supplied requested information','A customer replied to a request for more information.'); end if;
  insert into public.audit_events(organization_id,action,entity_type,entity_id,metadata) values(v_request.organization_id,'request.customer_information_received','request',v_request.id,jsonb_build_object('message_id',v_message.id));
 end if;
 return true;
end $$;
revoke all on function public.record_public_request_follow_up(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.record_public_request_follow_up(uuid,text,uuid,text) to service_role;

create function public.complete_whatsapp_handoff_delivery(p_organization_id uuid,p_delivery_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.whatsapp_message_deliveries set status='processed',processing_started_at=null,last_error_code=null
 where organization_id=p_organization_id and id=p_delivery_id and direction='inbound' and status='processing';
 return found;
end $$;
revoke all on function public.complete_whatsapp_handoff_delivery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_whatsapp_handoff_delivery(uuid,uuid) to service_role;
revoke all on function public.assign_handoff(uuid,uuid) from public,anon;
revoke all on function public.join_handoff(uuid) from public,anon;
revoke all on function public.send_handoff_message(uuid,uuid,text) from public,anon;
revoke all on function public.resolve_handoff(uuid,text,boolean) from public,anon;
grant execute on function public.assign_handoff(uuid,uuid) to authenticated;
grant execute on function public.join_handoff(uuid) to authenticated;
grant execute on function public.send_handoff_message(uuid,uuid,text) to authenticated;
grant execute on function public.resolve_handoff(uuid,text,boolean) to authenticated;

-- Follow-up questions are explicitly linked to the request and may reopen a confirmed conversation.
create or replace function public.request_more_information(p_request_id uuid,p_question text,p_expected_updated_at timestamptz)
returns public.requests language plpgsql security definer set search_path='' as $$
declare v_request public.requests; v_conversation public.conversations; v_actor public.organization_members; v_message public.messages;
begin
 select * into v_request from public.requests where id=p_request_id;
 if v_request.id is not null then select * into v_conversation from public.conversations where organization_id=v_request.organization_id and id=v_request.conversation_id and state<>'closed' for update; end if;
 select * into v_request from public.requests where id=p_request_id for update;
 if v_request.id is null or not private.can_access_request(v_request.organization_id,v_request.id) then raise exception using errcode='P0002',message='request_not_found'; end if;
 select * into v_actor from private.handoff_actor(v_request.organization_id);
 if v_actor.id is null or v_actor.role='viewer' then raise exception using errcode='42501',message='request_information_forbidden'; end if;
 if v_request.updated_at is distinct from p_expected_updated_at then raise exception using errcode='40001',message='stale_request'; end if;
 if length(btrim(p_question)) not between 1 and 2000 then raise exception using errcode='22023',message='invalid_question'; end if;
 if v_conversation.id is null then raise exception using errcode='23514',message='conversation_required'; end if;
 if v_request.status<>'awaiting_customer_information' and not private.valid_request_transition(v_request.status,'awaiting_customer_information') then raise exception using errcode='23514',message='invalid_transition'; end if;
 insert into public.messages(organization_id,conversation_id,sender_type,sender_member_id,content,metadata) values(v_request.organization_id,v_conversation.id,'employee',v_actor.id,btrim(p_question),jsonb_build_object('request_id',v_request.id,'message_kind','request_information')) returning * into v_message;
 update public.conversations set state='awaiting_customer',updated_at=now() where organization_id=v_request.organization_id and id=v_conversation.id and state<>'human_handoff';
 if v_request.status<>'awaiting_customer_information' then
  perform set_config('smartdesk.status_reason','Additional customer information requested',true); perform set_config('smartdesk.status_source','employee_dashboard',true);
  update public.requests set status='awaiting_customer_information' where organization_id=v_request.organization_id and id=v_request.id returning * into v_request;
  insert into public.audit_events(organization_id,actor_member_id,action,entity_type,entity_id,metadata) values(v_request.organization_id,v_actor.id,'request.status_changed','request',v_request.id,jsonb_build_object('new_status','awaiting_customer_information'));
 end if;
 insert into public.audit_events(organization_id,actor_member_id,action,entity_type,entity_id,metadata) values(v_request.organization_id,v_actor.id,'request.information_requested','request',v_request.id,jsonb_build_object('message_id',v_message.id));
 return v_request;
end $$;

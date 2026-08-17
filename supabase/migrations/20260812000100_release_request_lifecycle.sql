alter table public.attachments
  add column document_kind text not null default 'general',
  add column approved_at timestamptz,
  add column approved_by_member_id uuid,
  add constraint attachments_document_kind_check check (document_kind in ('general','quotation')),
  add constraint attachments_quotation_approval_check check (
    (document_kind = 'general' and approved_at is null and approved_by_member_id is null)
    or (document_kind = 'quotation' and approved_at is not null and approved_by_member_id is not null)
  ),
  add constraint attachments_approved_by_member_fkey foreign key (organization_id,approved_by_member_id)
    references public.organization_members(organization_id,id) on delete restrict;

create index attachments_approved_quotation_idx
  on public.attachments(organization_id,request_id,approved_at desc)
  where upload_status='active' and document_kind='quotation';

create function public.approve_quotation_attachment(p_request_id uuid,p_attachment_id uuid)
returns public.attachments language plpgsql security definer set search_path='' as $$
declare v_request public.requests; v_attachment public.attachments; v_actor public.organization_members;
begin
  select * into v_request from public.requests where id=p_request_id;
  if v_request.id is null or not private.can_access_request(v_request.organization_id,v_request.id) then
    raise exception using errcode='P0002',message='request_not_found';
  end if;
  select * into v_actor from public.organization_members where organization_id=v_request.organization_id and user_id=auth.uid() and is_active;
  if v_actor.id is null or v_actor.role not in ('admin','manager','commercial_officer') then
    raise exception using errcode='42501',message='quotation_approval_forbidden';
  end if;
  select * into v_attachment from public.attachments where organization_id=v_request.organization_id and id=p_attachment_id and request_id=v_request.id for update;
  if v_attachment.id is null then raise exception using errcode='P0002',message='attachment_not_found'; end if;
  if v_attachment.upload_status<>'active' or v_attachment.mime_type<>'application/pdf' or v_attachment.scan_status<>'clean' then
    raise exception using errcode='23514',message='quotation_attachment_invalid';
  end if;
  update public.attachments set document_kind='quotation',approved_at=now(),approved_by_member_id=v_actor.id
    where organization_id=v_request.organization_id and id=v_attachment.id returning * into v_attachment;
  insert into public.audit_events(organization_id,actor_member_id,action,entity_type,entity_id,metadata)
    values(v_request.organization_id,v_actor.id,'request.quotation_approved','attachment',v_attachment.id,jsonb_build_object('request_id',v_request.id));
  return v_attachment;
end $$;

revoke all on function public.approve_quotation_attachment(uuid,uuid) from public,anon;
grant execute on function public.approve_quotation_attachment(uuid,uuid) to authenticated;

create or replace function public.transition_request_status(p_request_id uuid,p_new_status text,p_reason text,p_expected_updated_at timestamptz)
returns public.requests language plpgsql security definer set search_path='' as $$
declare v_request public.requests; v_actor public.organization_members; v_pair text;
begin
  select * into v_request from public.requests where id=p_request_id for update;
  if v_request.id is null or not private.can_access_request(v_request.organization_id,v_request.id) then raise exception using errcode='P0002',message='request_not_found'; end if;
  select * into v_actor from public.organization_members where organization_id=v_request.organization_id and user_id=auth.uid() and is_active;
  if v_actor.id is null or v_actor.role='viewer' then raise exception using errcode='42501',message='transition_forbidden'; end if;
  if v_request.updated_at is distinct from p_expected_updated_at then raise exception using errcode='40001',message='stale_request'; end if;
  if not private.valid_request_transition(v_request.status,p_new_status) then raise exception using errcode='23514',message='invalid_transition'; end if;
  v_pair:=v_request.status||'->'||p_new_status;
  if v_actor.role not in ('admin','manager') and not (
    (v_actor.role='commercial_officer' and v_pair=any(array['new->awaiting_customer_information','new->awaiting_assessment','new->unsupported','new->cancelled','awaiting_customer_information->new','awaiting_customer_information->inactive','awaiting_customer_information->cancelled','awaiting_assessment->awaiting_customer_information','awaiting_assessment->unsupported','awaiting_assessment->cancelled','unsupported->closed','inactive->new','inactive->cancelled','awaiting_assessment->site_visit_proposed','awaiting_assessment->assessment_completed','site_visit_proposed->site_visit_scheduled','site_visit_scheduled->assessment_completed','assessment_completed->quotation_preparing','quotation_preparing->quotation_sent','quotation_sent->quotation_revision_requested','quotation_sent->quotation_accepted','quotation_sent->quotation_rejected','quotation_revision_requested->quotation_preparing','quotation_accepted->scheduled','quotation_rejected->closed']))
    or (v_actor.role='technical_officer' and v_pair=any(array['awaiting_assessment->site_visit_proposed','awaiting_assessment->assessment_completed','site_visit_proposed->site_visit_scheduled','site_visit_scheduled->assessment_completed']))
    or (v_actor.role='project_manager' and v_pair=any(array['quotation_accepted->scheduled','scheduled->in_progress','in_progress->awaiting_client_validation','awaiting_client_validation->completed','awaiting_client_validation->in_progress','completed->closed']))
    or (v_actor.role='support_officer' and v_request.request_type in ('support','complaint') and v_pair=any(array['new->awaiting_customer_information','new->cancelled','awaiting_customer_information->new','awaiting_customer_information->inactive','awaiting_customer_information->cancelled','awaiting_assessment->awaiting_customer_information','awaiting_assessment->unsupported','awaiting_assessment->cancelled','unsupported->closed','inactive->new','inactive->cancelled']))
  ) then raise exception using errcode='42501',message='transition_forbidden'; end if;
  if p_new_status='cancelled' and coalesce(length(btrim(p_reason)),0)=0 then raise exception using errcode='22023',message='cancellation_reason_required'; end if;
  if p_new_status in ('site_visit_proposed','site_visit_scheduled','quotation_accepted','scheduled','in_progress','completed') and coalesce(length(btrim(p_reason)),0)<3 then raise exception using errcode='23514',message='transition_provenance_required'; end if;
  if p_new_status in ('site_visit_scheduled','scheduled','in_progress') and v_request.assigned_member_id is null then raise exception using errcode='23514',message='responsible_employee_required'; end if;
  if p_new_status='quotation_sent' and not exists(select 1 from public.attachments a where a.organization_id=v_request.organization_id and a.request_id=v_request.id and a.upload_status='active' and a.document_kind='quotation' and a.mime_type='application/pdf' and a.approved_at is not null) then raise exception using errcode='23514',message='quotation_attachment_required'; end if;
  if p_reason is not null and length(btrim(p_reason)) not between 1 and 500 then raise exception using errcode='22023',message='invalid_reason'; end if;
  perform set_config('smartdesk.status_reason',coalesce(nullif(btrim(p_reason),''),''),true);
  perform set_config('smartdesk.status_source','employee_dashboard',true);
  update public.requests set status=p_new_status where organization_id=v_request.organization_id and id=v_request.id returning * into v_request;
  insert into public.audit_events(organization_id,actor_member_id,action,entity_type,entity_id,metadata) values(v_request.organization_id,v_actor.id,'request.status_changed','request',v_request.id,jsonb_build_object('new_status',p_new_status,'reason_recorded',p_reason is not null));
  return v_request;
end $$;

-- Harden WhatsApp test-channel delivery state without enabling production WhatsApp.

alter table public.whatsapp_message_deliveries
  drop constraint whatsapp_message_deliveries_status_check;
alter table public.whatsapp_message_deliveries
  add constraint whatsapp_message_deliveries_status_check check (
    status in (
      'received','processing','processed','queued','sending','retryable',
      'delivery_unknown','sent','delivered','read','failed','unsupported'
    )
  );

create function public.release_whatsapp_delivery(
  p_organization_id uuid,
  p_delivery_id uuid,
  p_error_code text
) returns boolean language sql security definer set search_path='' as $$
  update public.whatsapp_message_deliveries
    set status='received', processing_started_at=null,
        next_attempt_at=now(), last_error_code=p_error_code
  where organization_id=p_organization_id and id=p_delivery_id
    and direction='inbound' and status='processing'
    and p_error_code ~ '^[a-z0-9_]{1,60}$'
  returning true
$$;

create function public.claim_whatsapp_outbound(
  p_organization_id uuid,
  p_inbound_delivery_id uuid
) returns table(delivery_id uuid, message_content text) language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
begin
  return query
  update public.whatsapp_message_deliveries d
    set status='sending', attempt_count=d.attempt_count+1,
        processing_started_at=now(), next_attempt_at=null
  from public.messages m
  where d.organization_id=p_organization_id
    and d.reply_to_delivery_id=p_inbound_delivery_id
    and d.direction='outbound'
    and d.message_id=m.id and m.organization_id=d.organization_id
    and d.attempt_count<10
    and (
      d.status='queued'
      or (d.status='retryable' and d.next_attempt_at<=now())
    )
  returning d.id,m.content;
end $$;

create function public.record_whatsapp_send_result(
  p_organization_id uuid,
  p_delivery_id uuid,
  p_outcome text,
  p_provider_message_id text default null,
  p_error_code text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_updated integer;
begin
  if p_outcome not in ('sent','retryable','delivery_unknown','failed')
    or (p_provider_message_id is not null and length(p_provider_message_id) not between 3 and 256)
    or (p_error_code is not null and p_error_code !~ '^[a-z0-9_]{1,60}$') then
    raise exception using errcode='22023',message='invalid_whatsapp_send_result';
  end if;
  update public.whatsapp_message_deliveries set
    provider_message_id=case when p_outcome='sent' then p_provider_message_id else provider_message_id end,
    status=p_outcome,
    next_attempt_at=case when p_outcome='retryable' then now() else null end,
    last_error_code=case when p_outcome='sent' then null else p_error_code end
  where organization_id=p_organization_id and id=p_delivery_id
    and direction='outbound' and status='sending';
  get diagnostics v_updated=row_count;
  return v_updated=1;
end $$;

revoke all on function public.release_whatsapp_delivery(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.claim_whatsapp_outbound(uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_whatsapp_send_result(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.release_whatsapp_delivery(uuid,uuid,text) to service_role;
grant execute on function public.claim_whatsapp_outbound(uuid,uuid) to service_role;
grant execute on function public.record_whatsapp_send_result(uuid,uuid,text,text,text) to service_role;

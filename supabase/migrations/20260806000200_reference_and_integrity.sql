create function private.next_request_reference(p_organization_id uuid, p_created_at timestamptz default now()) returns text
language plpgsql security definer set search_path = '' as $$
declare v_year integer; v_value bigint; v_prefix text;
begin
  select reference_prefix into v_prefix from public.organizations where id=p_organization_id and is_active;
  if v_prefix is null then raise exception using errcode='23503', message='active organization required'; end if;
  v_year := extract(year from p_created_at at time zone 'UTC')::integer;
  insert into public.request_reference_counters(organization_id,reference_year,last_value)
    values(p_organization_id,v_year,1)
    on conflict(organization_id,reference_year) do update set last_value=public.request_reference_counters.last_value+1,updated_at=now()
    returning last_value into v_value;
  return format('%s-%s-%s',v_prefix,v_year,lpad(v_value::text,6,'0'));
end $$;
revoke all on function private.next_request_reference(uuid,timestamptz) from public, anon, authenticated;

create function private.assign_request_reference() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.reference_number is not null and btrim(new.reference_number) <> '' then
    raise exception using errcode='22023',message='request references are server generated';
  end if;
  new.reference_number := private.next_request_reference(new.organization_id,new.created_at);
  return new;
end $$;
create trigger requests_assign_reference before insert on public.requests for each row execute function private.assign_request_reference();

create function private.protect_request_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if new.organization_id<>old.organization_id or new.reference_number<>old.reference_number or new.idempotency_key<>old.idempotency_key then
    raise exception using errcode='22023',message='request identity fields are immutable';
  end if;
  return new;
end $$;
create trigger requests_protect_identity before update on public.requests for each row execute function private.protect_request_identity();

create function private.enforce_conversation_request_pair() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_table_name='conversations' then
    if new.request_id is not null and not exists(
      select 1 from public.requests r where r.organization_id=new.organization_id and r.id=new.request_id and r.conversation_id=new.id
    ) then raise exception using errcode='23514',message='conversation and request links must be reciprocal'; end if;
  elsif tg_table_name='requests' then
    if new.conversation_id is not null and not exists(
      select 1 from public.conversations c where c.organization_id=new.organization_id and c.id=new.conversation_id and c.request_id=new.id
    ) then raise exception using errcode='23514',message='request and conversation links must be reciprocal'; end if;
  end if;
  return null;
end $$;
create constraint trigger conversations_request_pair after insert or update of request_id on public.conversations deferrable initially deferred for each row execute function private.enforce_conversation_request_pair();
create constraint trigger requests_conversation_pair after insert or update of conversation_id on public.requests deferrable initially deferred for each row execute function private.enforce_conversation_request_pair();

create function private.record_request_status_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    insert into public.request_status_history(organization_id,request_id,to_status) values(new.organization_id,new.id,new.status);
  elsif new.status is distinct from old.status then
    insert into public.request_status_history(organization_id,request_id,from_status,to_status,changed_by_member_id)
      values(new.organization_id,new.id,old.status,new.status,private.current_member_id(new.organization_id));
  end if;
  return new;
end $$;

create function private.prevent_history_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception using errcode='55000',message='history and audit rows are append-only'; end $$;
create trigger request_status_history_append_only before update or delete on public.request_status_history for each row execute function private.prevent_history_mutation();
create trigger audit_events_append_only before update or delete on public.audit_events for each row execute function private.prevent_history_mutation();

create function private.enforce_organization_immutable() returns trigger language plpgsql set search_path='' as $$
begin if new.organization_id<>old.organization_id then raise exception using errcode='22023',message='organization_id is immutable'; end if; return new; end $$;
do $$ declare t text; begin
  foreach t in array array['organization_members','departments','services','customers','conversations','messages','request_status_history','assignments','attachments','internal_notes','human_handoffs','knowledge_documents','notifications','feedback','audit_events'] loop
    execute format('create trigger %I_organization_immutable before update on public.%I for each row execute function private.enforce_organization_immutable()',t,t);
  end loop;
end $$;

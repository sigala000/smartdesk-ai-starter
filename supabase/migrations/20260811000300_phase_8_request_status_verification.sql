create table public.status_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  request_id uuid,
  subject_digest text not null check (subject_digest ~ '^[a-f0-9]{64}$'),
  code_digest text not null check (code_digest ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check (state in ('pending','verified','expired','locked','superseded','delivery_failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null check (max_attempts between 1 and 10),
  expires_at timestamptz not null,
  locked_until timestamptz,
  verified_at timestamptz,
  consumed_at timestamptz,
  superseded_at timestamptz,
  delivery_outcome text not null default 'synthetic' check (delivery_outcome in ('synthetic','pending','accepted','failed')),
  created_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete restrict,
  foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete restrict,
  check ((organization_id is null and request_id is null) or (organization_id is not null and request_id is not null)),
  check (expires_at > created_at)
);

create table public.status_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null,
  challenge_id uuid not null,
  conversation_id uuid,
  access_kind text not null default 'browser' check (access_kind in ('browser','conversation')),
  token_digest text not null unique check (token_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete restrict,
  foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete restrict,
  foreign key (organization_id,challenge_id) references public.status_verification_challenges(organization_id,id) on delete restrict,
  foreign key (organization_id,conversation_id) references public.conversations(organization_id,id) on delete restrict,
  check ((access_kind='browser' and conversation_id is null) or (access_kind='conversation' and conversation_id is not null)),
  check (expires_at > created_at)
);

create table public.status_verification_events (
  id bigint generated always as identity primary key,
  organization_id uuid,
  challenge_id uuid,
  subject_digest text not null check (subject_digest ~ '^[a-f0-9]{64}$'),
  event_type text not null check (event_type in ('challenge_requested','delivery_accepted','delivery_failed','verification_failed','verification_locked','verification_succeeded','token_read','token_rejected','rate_limited')),
  outcome_code text not null check (outcome_code ~ '^[a-z_]{1,60}$'),
  trace_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id) references public.organizations(id) on delete restrict,
  foreign key (organization_id,challenge_id) references public.status_verification_challenges(organization_id,id) on delete restrict
);

create index status_challenges_expiry_idx on public.status_verification_challenges(expires_at) where state='pending';
create index status_challenges_subject_idx on public.status_verification_challenges(subject_digest,created_at desc);
create unique index status_challenges_one_pending_subject_idx on public.status_verification_challenges(subject_digest) where state='pending';
create index status_tokens_expiry_idx on public.status_verification_tokens(expires_at) where revoked_at is null and consumed_at is null;
create index status_tokens_conversation_idx on public.status_verification_tokens(organization_id,conversation_id,request_id,expires_at) where access_kind='conversation' and revoked_at is null and consumed_at is null;
create index status_events_review_idx on public.status_verification_events(organization_id,created_at desc);

alter table public.status_verification_challenges enable row level security;
alter table public.status_verification_challenges force row level security;
alter table public.status_verification_tokens enable row level security;
alter table public.status_verification_tokens force row level security;
alter table public.status_verification_events enable row level security;
alter table public.status_verification_events force row level security;
revoke all on public.status_verification_challenges,public.status_verification_tokens,public.status_verification_events from public,anon,authenticated;
grant select,insert,update,delete on public.status_verification_challenges,public.status_verification_tokens,public.status_verification_events to service_role;
grant usage,select on sequence public.status_verification_events_id_seq to service_role;

create function public.find_status_target(p_organization_slug text,p_reference_number text)
returns table(organization_id uuid,request_id uuid,reference_number text,phone text,service_name text,status text,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select o.id,r.id,r.reference_number,c.phone,s.name,r.status,r.updated_at
 from public.organizations o
 join public.requests r on r.organization_id=o.id and r.reference_number=p_reference_number
 join public.customers c on c.organization_id=r.organization_id and c.id=r.customer_id
 left join public.services s on s.organization_id=r.organization_id and s.id=r.service_id
 where o.slug=p_organization_slug and o.is_active=true and c.phone is not null
 limit 1
$$;
revoke all on function public.find_status_target(text,text) from public,anon,authenticated;
grant execute on function public.find_status_target(text,text) to service_role;

create function public.verify_status_challenge(
  p_challenge_id uuid,p_code_digest text,p_token_digest text,p_conversation_token_digest text,
  p_organization_id uuid,p_conversation_id uuid,
  p_token_ttl_seconds integer,p_lockout_seconds integer,p_trace_id uuid
) returns table(success boolean,token_expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_challenge public.status_verification_challenges; v_token_expires timestamptz;
begin
 if p_code_digest !~ '^[a-f0-9]{64}$' or p_token_digest !~ '^[a-f0-9]{64}$'
   or (p_conversation_token_digest is not null and p_conversation_token_digest !~ '^[a-f0-9]{64}$')
   or ((p_organization_id is null) <> (p_conversation_id is null))
   or p_token_ttl_seconds not between 60 and 3600 or p_lockout_seconds not between 60 and 86400 then
  raise exception using errcode='22023',message='invalid_verification_input';
 end if;
 select * into v_challenge from public.status_verification_challenges where id=p_challenge_id for update;
 if v_challenge.id is null then return query select false,null::timestamptz; return; end if;
 if v_challenge.state<>'pending' or v_challenge.expires_at<=now() or v_challenge.locked_until>now() then
  if v_challenge.state='pending' and v_challenge.expires_at<=now() then update public.status_verification_challenges set state='expired' where id=v_challenge.id; end if;
  return query select false,null::timestamptz; return;
 end if;
 if v_challenge.code_digest<>p_code_digest or v_challenge.organization_id is null or v_challenge.request_id is null or v_challenge.delivery_outcome<>'accepted' then
  update public.status_verification_challenges set attempt_count=attempt_count+1,
   state=case when attempt_count+1>=max_attempts then 'locked' else state end,
   locked_until=case when attempt_count+1>=max_attempts then now()+make_interval(secs=>p_lockout_seconds) else locked_until end
   where id=v_challenge.id returning * into v_challenge;
  insert into public.status_verification_events(organization_id,challenge_id,subject_digest,event_type,outcome_code,trace_id)
   values(v_challenge.organization_id,case when v_challenge.organization_id is null then null else v_challenge.id end,v_challenge.subject_digest,
    case when v_challenge.state='locked' then 'verification_locked' else 'verification_failed' end,'invalid_or_expired',p_trace_id);
  return query select false,null::timestamptz; return;
 end if;
 if p_organization_id is not null and (p_organization_id<>v_challenge.organization_id or not exists(
   select 1 from public.conversations c where c.organization_id=p_organization_id and c.id=p_conversation_id
 )) then
  return query select false,null::timestamptz; return;
 end if;
 v_token_expires:=now()+make_interval(secs=>p_token_ttl_seconds);
 update public.status_verification_challenges set state='verified',verified_at=now(),consumed_at=now() where id=v_challenge.id;
 insert into public.status_verification_tokens(organization_id,request_id,challenge_id,access_kind,token_digest,expires_at)
  values(v_challenge.organization_id,v_challenge.request_id,v_challenge.id,'browser',p_token_digest,v_token_expires);
 if p_conversation_id is not null then
  insert into public.status_verification_tokens(organization_id,request_id,challenge_id,conversation_id,access_kind,token_digest,expires_at)
   values(v_challenge.organization_id,v_challenge.request_id,v_challenge.id,p_conversation_id,'conversation',p_conversation_token_digest,v_token_expires);
 end if;
 insert into public.status_verification_events(organization_id,challenge_id,subject_digest,event_type,outcome_code,trace_id)
  values(v_challenge.organization_id,v_challenge.id,v_challenge.subject_digest,'verification_succeeded','verified',p_trace_id);
 return query select true,v_token_expires;
end $$;
revoke all on function public.verify_status_challenge(uuid,text,text,text,uuid,uuid,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.verify_status_challenge(uuid,text,text,text,uuid,uuid,integer,integer,uuid) to service_role;

create function public.consume_status_token(p_token_digest text,p_reference_number text,p_trace_id uuid)
returns table(reference_number text,service_name text,status text,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_token public.status_verification_tokens;
begin
 select * into v_token from public.status_verification_tokens
  where token_digest=p_token_digest and access_kind='browser' for update;
 if v_token.id is null or v_token.revoked_at is not null or v_token.consumed_at is not null or v_token.expires_at<=now() then
  insert into public.status_verification_events(subject_digest,event_type,outcome_code,trace_id)
   values(p_token_digest,'token_rejected','invalid_or_expired',p_trace_id);
  return;
 end if;
 update public.status_verification_tokens set consumed_at=now() where id=v_token.id;
 if not exists(select 1 from public.requests r where r.organization_id=v_token.organization_id and r.id=v_token.request_id and r.reference_number=p_reference_number) then
  insert into public.status_verification_events(organization_id,challenge_id,subject_digest,event_type,outcome_code,trace_id)
   values(v_token.organization_id,v_token.challenge_id,p_token_digest,'token_rejected','request_mismatch',p_trace_id);
  return;
 end if;
 insert into public.status_verification_events(organization_id,challenge_id,subject_digest,event_type,outcome_code,trace_id)
  values(v_token.organization_id,v_token.challenge_id,p_token_digest,'token_read','accepted',p_trace_id);
 return query select r.reference_number,coalesce(s.name,'Not specified'),r.status,r.updated_at
  from public.requests r left join public.services s on s.organization_id=r.organization_id and s.id=r.service_id
  where r.organization_id=v_token.organization_id and r.id=v_token.request_id;
end $$;

create function public.consume_conversation_status_grant(p_organization_id uuid,p_conversation_id uuid,p_reference_number text,p_trace_id uuid)
returns table(reference_number text,service_name text,status text,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_token public.status_verification_tokens;
begin
 select * into v_token from public.status_verification_tokens
  where organization_id=p_organization_id and conversation_id=p_conversation_id and access_kind='conversation'
   and revoked_at is null and consumed_at is null and expires_at>now()
  order by created_at desc limit 1 for update skip locked;
 if v_token.id is null then return; end if;
 update public.status_verification_tokens set consumed_at=now() where id=v_token.id;
 if not exists(select 1 from public.requests r where r.organization_id=p_organization_id and r.id=v_token.request_id and r.reference_number=p_reference_number) then
  insert into public.status_verification_events(organization_id,challenge_id,subject_digest,event_type,outcome_code,trace_id)
   values(v_token.organization_id,v_token.challenge_id,v_token.token_digest,'token_rejected','request_mismatch',p_trace_id);
  return;
 end if;
 insert into public.status_verification_events(organization_id,challenge_id,subject_digest,event_type,outcome_code,trace_id)
  values(v_token.organization_id,v_token.challenge_id,v_token.token_digest,'token_read','accepted',p_trace_id);
 return query select r.reference_number,coalesce(s.name,'Not specified'),r.status,r.updated_at
  from public.requests r left join public.services s on s.organization_id=r.organization_id and s.id=r.service_id
  where r.organization_id=v_token.organization_id and r.id=v_token.request_id;
end $$;

revoke all on function public.consume_status_token(text,text,uuid),public.consume_conversation_status_grant(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.consume_status_token(text,text,uuid),public.consume_conversation_status_grant(uuid,uuid,text,uuid) to service_role;

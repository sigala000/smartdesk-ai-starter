create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null check (length(btrim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), reference_prefix text not null unique check (reference_prefix ~ '^[A-Z0-9]{2,10}$'),
  timezone text not null default 'UTC', default_language text not null default 'en' check (default_language ~ '^[a-z]{2}(?:-[A-Z]{2})?$'),
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','manager','commercial_officer','technical_officer','project_manager','support_officer','viewer')),
  department_id uuid, display_name text not null check (length(btrim(display_name)) between 1 and 160), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id), unique (organization_id,user_id), foreign key (organization_id) references public.organizations(id) on delete cascade
);

create table public.departments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, name text not null check (length(btrim(name)) between 1 and 120),
  description text, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id), unique (organization_id,name), foreign key (organization_id) references public.organizations(id) on delete cascade
);
alter table public.organization_members add constraint organization_members_department_fk foreign key (organization_id,department_id) references public.departments(organization_id,id) on delete set null;

create table public.services (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, department_id uuid,
  name text not null check (length(btrim(name)) between 1 and 160), description text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id), unique (organization_id,name),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,department_id) references public.departments(organization_id,id) on delete set null
);

create table public.customers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, full_name text check (full_name is null or length(btrim(full_name)) between 1 and 160),
  email text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'), phone text check (phone is null or length(btrim(phone)) between 6 and 32),
  preferred_language text not null default 'en', consent_to_contact boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id), foreign key (organization_id) references public.organizations(id) on delete cascade,
  check (full_name is not null or email is not null or phone is not null)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, customer_id uuid not null, request_id uuid,
  channel text not null default 'web' check (channel = 'web'), state text not null default 'open' check (state in ('open','awaiting_customer','human_handoff','resolved','closed')),
  assigned_member_id uuid, started_at timestamptz not null default now(), closed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id), foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,customer_id) references public.customers(organization_id,id) on delete restrict,
  foreign key (organization_id,assigned_member_id) references public.organization_members(organization_id,id) on delete set null,
  check ((state = 'closed' and closed_at is not null) or state <> 'closed')
);

create table public.requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, customer_id uuid not null, conversation_id uuid,
  service_id uuid, department_id uuid, assigned_member_id uuid, reference_number text not null,
  request_type text not null check (request_type in ('quotation','site_visit','service_question','complaint','support','other')),
  status text not null default 'new' check (status in ('draft','new','awaiting_customer_information','awaiting_assessment','site_visit_proposed','site_visit_scheduled','assessment_completed','quotation_preparing','quotation_sent','quotation_revision_requested','quotation_accepted','quotation_rejected','scheduled','in_progress','awaiting_client_validation','completed','cancelled','unsupported','inactive','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')), title text not null check (length(btrim(title)) between 1 and 240),
  description text, location text, idempotency_key uuid not null, confirmed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id), unique (organization_id,reference_number), unique (organization_id,idempotency_key),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,customer_id) references public.customers(organization_id,id) on delete restrict,
  foreign key (organization_id,conversation_id) references public.conversations(organization_id,id) on delete restrict deferrable initially deferred,
  foreign key (organization_id,service_id) references public.services(organization_id,id) on delete set null,
  foreign key (organization_id,department_id) references public.departments(organization_id,id) on delete set null,
  foreign key (organization_id,assigned_member_id) references public.organization_members(organization_id,id) on delete set null
);
alter table public.conversations add constraint conversations_request_fk foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete set null deferrable initially deferred;

create table public.messages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, conversation_id uuid not null,
  sender_type text not null check (sender_type in ('customer','assistant','employee','system','tool')), sender_member_id uuid,
  content text not null check (length(btrim(content)) > 0), metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'), created_at timestamptz not null default now(),
  unique (organization_id,id), foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,conversation_id) references public.conversations(organization_id,id) on delete cascade,
  foreign key (organization_id,sender_member_id) references public.organization_members(organization_id,id) on delete set null,
  check ((sender_type='employee' and sender_member_id is not null) or sender_type<>'employee')
);

create table public.request_status_history (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, request_id uuid not null,
  from_status text, to_status text not null, changed_by_member_id uuid, reason text, created_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete cascade,
  foreign key (organization_id,changed_by_member_id) references public.organization_members(organization_id,id) on delete set null,
  check (from_status is null or from_status <> to_status)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, request_id uuid not null, member_id uuid not null,
  assigned_by_member_id uuid, assigned_at timestamptz not null default now(), unassigned_at timestamptz, created_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete cascade,
  foreign key (organization_id,member_id) references public.organization_members(organization_id,id) on delete restrict,
  foreign key (organization_id,assigned_by_member_id) references public.organization_members(organization_id,id) on delete set null,
  check (unassigned_at is null or unassigned_at >= assigned_at)
);
create unique index assignments_one_active_per_request on public.assignments(organization_id,request_id) where unassigned_at is null;

create table public.attachments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, request_id uuid, message_id uuid,
  storage_bucket text not null, storage_path text not null, original_filename text not null, mime_type text not null, size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  uploaded_by_member_id uuid, created_at timestamptz not null default now(), unique (organization_id,id), unique (storage_bucket,storage_path),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete cascade,
  foreign key (organization_id,message_id) references public.messages(organization_id,id) on delete cascade,
  foreign key (organization_id,uploaded_by_member_id) references public.organization_members(organization_id,id) on delete set null,
  check ((request_id is not null)::integer + (message_id is not null)::integer = 1)
);

create table public.internal_notes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, request_id uuid not null, author_member_id uuid not null,
  content text not null check (length(btrim(content)) > 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete cascade,
  foreign key (organization_id,author_member_id) references public.organization_members(organization_id,id) on delete restrict
);

create table public.human_handoffs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, conversation_id uuid not null, request_id uuid,
  status text not null default 'requested' check (status in ('requested','queued','assigned','active','resolved','cancelled')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')), reason text not null check (length(btrim(reason)) > 0),
  assigned_member_id uuid, requested_at timestamptz not null default now(), resolved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,conversation_id) references public.conversations(organization_id,id) on delete cascade,
  foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete cascade,
  foreign key (organization_id,assigned_member_id) references public.organization_members(organization_id,id) on delete set null,
  check ((status in ('resolved','cancelled') and resolved_at is not null) or status not in ('resolved','cancelled'))
);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, service_id uuid, title text not null check (length(btrim(title)) between 1 and 240),
  content text not null check (length(btrim(content)) > 0), document_type text not null default 'faq' check (document_type in ('faq','service','policy','process')),
  status text not null default 'draft' check (status in ('draft','approved','archived')), approved_by_member_id uuid, approved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,service_id) references public.services(organization_id,id) on delete set null,
  foreign key (organization_id,approved_by_member_id) references public.organization_members(organization_id,id) on delete set null,
  check ((status='approved' and approved_at is not null) or status<>'approved')
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, recipient_member_id uuid not null, request_id uuid,
  kind text not null check (length(btrim(kind)) between 1 and 80), title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,recipient_member_id) references public.organization_members(organization_id,id) on delete cascade,
  foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete cascade
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, request_id uuid not null, customer_id uuid not null,
  rating smallint not null check (rating between 1 and 5), comment text, created_at timestamptz not null default now(), unique (organization_id,id), unique (organization_id,request_id,customer_id),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,request_id) references public.requests(organization_id,id) on delete cascade,
  foreign key (organization_id,customer_id) references public.customers(organization_id,id) on delete restrict
);

create table public.request_reference_counters (
  organization_id uuid not null, reference_year integer not null check (reference_year between 2020 and 9999), last_value bigint not null check (last_value > 0),
  updated_at timestamptz not null default now(), primary key (organization_id,reference_year), foreign key (organization_id) references public.organizations(id) on delete cascade
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, actor_member_id uuid, action text not null, entity_type text not null, entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'), created_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id) references public.organizations(id) on delete cascade,
  foreign key (organization_id,actor_member_id) references public.organization_members(organization_id,id) on delete set null
);

create index organization_members_user_idx on public.organization_members(user_id,organization_id) where is_active;
create index services_department_idx on public.services(organization_id,department_id) where is_active;
create index customers_phone_idx on public.customers(organization_id,phone) where phone is not null;
create index customers_email_idx on public.customers(organization_id,lower(email)) where email is not null;
create index conversations_customer_idx on public.conversations(organization_id,customer_id,started_at desc);
create index conversations_state_idx on public.conversations(organization_id,state,updated_at desc);
create index requests_status_idx on public.requests(organization_id,status,created_at desc);
create index requests_assignee_idx on public.requests(organization_id,assigned_member_id,status);
create index requests_department_idx on public.requests(organization_id,department_id,status);
create index messages_conversation_idx on public.messages(organization_id,conversation_id,created_at);
create index request_status_history_request_idx on public.request_status_history(organization_id,request_id,created_at);
create index attachments_request_idx on public.attachments(organization_id,request_id) where request_id is not null;
create index internal_notes_request_idx on public.internal_notes(organization_id,request_id,created_at);
create index handoffs_queue_idx on public.human_handoffs(organization_id,status,priority,requested_at);
create index knowledge_lookup_idx on public.knowledge_documents(organization_id,status,document_type);
create index notifications_unread_idx on public.notifications(organization_id,recipient_member_id,created_at desc) where read_at is null;
create index audit_events_entity_idx on public.audit_events(organization_id,entity_type,entity_id,created_at);

do $$ declare t text; begin
  foreach t in array array['organizations','organization_members','departments','services','customers','conversations','requests','internal_notes','human_handoffs','knowledge_documents'] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()',t,t);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

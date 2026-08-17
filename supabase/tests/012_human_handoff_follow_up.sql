begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into public.organizations(id,name,slug,reference_prefix) values
('d0000000-0000-4000-8000-000000000001','Handoff A','handoff-a','HA'),
('d0000000-0000-4000-8000-000000000002','Handoff B','handoff-b','HB');
insert into public.departments(id,organization_id,name) values
('d1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Customer Support'),
('d1000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000002','Customer Support');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('d2000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-ha@example.test','',now(),now()),
('d2000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','support-ha@example.test','',now(),now()),
('d2000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-hb@example.test','',now(),now());
insert into public.organization_members(id,organization_id,user_id,role,department_id,display_name) values
('d3000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','manager','d1000000-0000-4000-8000-000000000001','Manager A'),
('d3000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','support_officer','d1000000-0000-4000-8000-000000000001','Support A'),
('d3000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000003','manager','d1000000-0000-4000-8000-000000000002','Manager B');
insert into public.customers(id,organization_id,full_name) values('d4000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Customer A');
insert into public.conversations(id,organization_id,customer_id) values('d5000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001');
insert into public.public_conversation_access(conversation_id,organization_id,token_digest,expires_at) values('d5000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',repeat('d',64),now()+interval '1 day');

select ok(not has_function_privilege('anon','public.request_public_handoff(uuid,text,uuid,text,text,text)','EXECUTE'),'anon cannot execute handoff creation');
select lives_ok($$select public.request_public_handoff('d5000000-0000-4000-8000-000000000001',repeat('d',64),'d6000000-0000-4000-8000-000000000001','Customer requested a human','explicit_human_request','normal')$$,'trusted creation succeeds');
select is((select count(*) from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),1::bigint,'one handoff is created');
select is((select status from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),'queued','handoff is queued, not active');
select is((select state from public.conversations where id='d5000000-0000-4000-8000-000000000001'),'human_handoff','conversation is paused');
select lives_ok($$select public.request_public_handoff('d5000000-0000-4000-8000-000000000001',repeat('d',64),'d6000000-0000-4000-8000-000000000002','Safety issue reported','safety_concern','urgent')$$,'repeat escalation is idempotent');
select is((select count(*) from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),1::bigint,'retry does not duplicate handoff');
select is((select priority from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),'urgent','priority can only elevate');

set local role authenticated;
select set_config('request.jwt.claim.sub','d2000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.assign_handoff((select id from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),'d3000000-0000-4000-8000-000000000003')$$,'23514',null,'cross-tenant assignee is rejected');
select lives_ok($$select public.assign_handoff((select id from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),'d3000000-0000-4000-8000-000000000002')$$,'same-tenant assignment succeeds');
select is((select status from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),'assigned','assignment does not imply join');
select set_config('request.jwt.claim.sub','d2000000-0000-4000-8000-000000000002',true);
select lives_ok($$select public.join_handoff((select id from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'))$$,'assigned employee explicitly joins');
select is((select status from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),'active','join establishes active ownership');
select lives_ok($$select public.send_handoff_message((select id from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),'d7000000-0000-4000-8000-000000000001','Hello from support')$$,'active owner can reply');
select lives_ok($$select public.send_handoff_message((select id from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),'d7000000-0000-4000-8000-000000000001','Hello from support')$$,'employee retry is idempotent');
select is((select count(*) from public.messages where content='Hello from support'),1::bigint,'retry creates one employee message');
select lives_ok($$select public.resolve_handoff((select id from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),'Support issue resolved',true)$$,'owner resolves and explicitly resumes');
reset role;
select lives_ok($$select public.request_public_handoff('d5000000-0000-4000-8000-000000000001',repeat('d',64),'d6000000-0000-4000-8000-000000000001','Customer requested a human','explicit_human_request','normal')$$,'terminal idempotency retry returns the original result');
select is((select count(*) from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'),1::bigint,'terminal idempotency retry creates no new handoff');
set local role authenticated;
select set_config('request.jwt.claim.sub','d2000000-0000-4000-8000-000000000001',true);
select is((select state from public.conversations where id='d5000000-0000-4000-8000-000000000001'),'open','automation resumes only from resolve flag');
select is((select count(*) from public.audit_events where entity_type='human_handoff'),6::bigint,'handoff lifecycle is audited');
select set_config('request.jwt.claim.sub','d2000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.human_handoffs),0::bigint,'foreign tenant cannot list handoffs');
select throws_ok($$select public.join_handoff((select id from public.human_handoffs where conversation_id='d5000000-0000-4000-8000-000000000001'))$$,'P0002',null,'foreign tenant cannot join');
reset role;
select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into public.organizations(id,name,slug,reference_prefix) values
('60000000-0000-4000-8000-000000000001','Request Tenant A','request-tenant-a','RA'),
('60000000-0000-4000-8000-000000000002','Request Tenant B','request-tenant-b','RB');
insert into public.departments(id,organization_id,name) values
('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Commercial A'),
('61000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','Technical A'),
('61000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000002','Technical B');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('62000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-request-a@example.test','',now(),now()),
('62000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','technical-request-a@example.test','',now(),now()),
('62000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','viewer-request-b@example.test','',now(),now());
insert into public.organization_members(id,organization_id,user_id,role,department_id,display_name) values
('63000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','manager','61000000-0000-4000-8000-000000000001','Manager A'),
('63000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002','technical_officer','61000000-0000-4000-8000-000000000002','Technical A'),
('63000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000003','viewer','61000000-0000-4000-8000-000000000003','Viewer B');
insert into public.services(id,organization_id,department_id,name) values
('64000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','Service A'),
('64000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003','Service B');
insert into public.customers(id,organization_id,full_name,email) values
('65000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','Customer A','customer-a@example.test'),
('65000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','Customer B','customer-b@example.test');
insert into public.conversations(id,organization_id,customer_id) values
('66000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001');
insert into public.requests(id,organization_id,customer_id,conversation_id,service_id,department_id,reference_number,request_type,status,title,description,location,idempotency_key,confirmed_at) values
('67000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',null,'quotation','new','Request A','Request A description','Yaounde','67000000-0000-4000-8000-000000000011',now()),
('67000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','65000000-0000-4000-8000-000000000002',null,'64000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003',null,'support','new','Request B','Request B description','Douala','67000000-0000-4000-8000-000000000012',now());
update public.conversations set request_id='67000000-0000-4000-8000-000000000001' where id='66000000-0000-4000-8000-000000000001';

select ok(not has_function_privilege('anon','public.assign_request(uuid,uuid,uuid,text,timestamptz)','EXECUTE'),'anonymous cannot execute assignment transaction');
select ok(not has_function_privilege('anon','public.transition_request_status(uuid,text,text,timestamptz)','EXECUTE'),'anonymous cannot execute status transaction');

set local role authenticated;
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.requests),1::bigint,'manager lists only own-tenant requests');
select is((select count(*) from public.customers),1::bigint,'manager reads only own-tenant customers');
select throws_ok($$update public.requests set status='completed' where id='67000000-0000-4000-8000-000000000001'$$,'42501',null,'direct request mutation is denied');
select throws_ok($$select public.assign_request('67000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000003','63000000-0000-4000-8000-000000000003',null,(select updated_at from public.requests where id='67000000-0000-4000-8000-000000000001'))$$,'22023',null,'cross-tenant assignment target is rejected');
select lives_ok($$select public.assign_request('67000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002','63000000-0000-4000-8000-000000000002','Technical review',(select updated_at from public.requests where id='67000000-0000-4000-8000-000000000001'))$$,'same-tenant active employee can be assigned');
select is((select assigned_member_id from public.requests where id='67000000-0000-4000-8000-000000000001'),'63000000-0000-4000-8000-000000000002'::uuid,'request stores the current employee');
select is((select count(*) from public.assignments where request_id='67000000-0000-4000-8000-000000000001' and unassigned_at is null),1::bigint,'one active assignment history row exists');
select is((select count(*) from public.audit_events where entity_id='67000000-0000-4000-8000-000000000001' and action='request.assignment_changed'),1::bigint,'assignment creates an audit event');
select lives_ok($$select public.transition_request_status('67000000-0000-4000-8000-000000000001','awaiting_assessment','Initial review complete',(select updated_at from public.requests where id='67000000-0000-4000-8000-000000000001'))$$,'valid status transition succeeds');
select is((select reason from public.request_status_history where request_id='67000000-0000-4000-8000-000000000001' and to_status='awaiting_assessment'),'Initial review complete','status history records reason');
select is((select source from public.request_status_history where request_id='67000000-0000-4000-8000-000000000001' and to_status='awaiting_assessment'),'employee_dashboard','status history records source');
select is((select count(*) from public.audit_events where entity_id='67000000-0000-4000-8000-000000000001' and action='request.status_changed'),1::bigint,'status transition creates an audit event');
select throws_ok($$select public.transition_request_status('67000000-0000-4000-8000-000000000001','completed',null,(select updated_at from public.requests where id='67000000-0000-4000-8000-000000000001'))$$,'23514',null,'invalid status transition is rejected');
select lives_ok($$select public.transition_request_status('67000000-0000-4000-8000-000000000001','site_visit_proposed','Visit needed',(select updated_at from public.requests where id='67000000-0000-4000-8000-000000000001'))$$,'evidence-bearing site-visit proposal succeeds');
select is((select count(*) from public.request_status_history where request_id='67000000-0000-4000-8000-000000000001' and to_status='site_visit_proposed'),1::bigint,'site visit transition creates history');
select lives_ok($$select public.transition_request_status('67000000-0000-4000-8000-000000000001','site_visit_scheduled','Visit scheduled for 2026-08-20',(select updated_at from public.requests where id='67000000-0000-4000-8000-000000000001'))$$,'responsible assigned employee permits scheduling');
select lives_ok($$select public.transition_request_status('67000000-0000-4000-8000-000000000001','assessment_completed','Assessment recorded',(select updated_at from public.requests where id='67000000-0000-4000-8000-000000000001'))$$,'assessment can complete');
select lives_ok($$select public.add_internal_note('67000000-0000-4000-8000-000000000001','Employee-only note')$$,'authorized employee can add an internal note');
select is((select count(*) from public.internal_notes where content='Employee-only note'),1::bigint,'internal note is stored for employees');
reset role;
update public.requests set status='new' where id='67000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.request_more_information('67000000-0000-4000-8000-000000000001','What is the approximate room size?',(select updated_at from public.requests where id='67000000-0000-4000-8000-000000000001'))$$,'request-information action succeeds for a linked active conversation');
select is((select status from public.requests where id='67000000-0000-4000-8000-000000000001'),'awaiting_customer_information','request-information action updates status');
select is((select count(*) from public.messages where conversation_id='66000000-0000-4000-8000-000000000001' and sender_type='employee' and content='What is the approximate room size?'),1::bigint,'customer-safe employee question is stored');
select is((select count(*) from public.audit_events where entity_id='67000000-0000-4000-8000-000000000001' and action='request.information_requested'),1::bigint,'request-information action is audited');
select is((select count(*) from public.audit_events where entity_id='67000000-0000-4000-8000-000000000001' and action='request.status_changed'),5::bigint,'request-information status change receives a status audit event');
select is((select metadata->>'request_id' from public.messages where conversation_id='66000000-0000-4000-8000-000000000001' and content='What is the approximate room size?'),'67000000-0000-4000-8000-000000000001','information question is linked to the request');
select is((select state from public.conversations where id='66000000-0000-4000-8000-000000000001'),'awaiting_customer','conversation waits for the same customer');
reset role;
insert into public.public_conversation_access(conversation_id,organization_id,token_digest,expires_at) values('66000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',repeat('6',64),now()+interval '1 day');
select ok(public.record_public_request_follow_up('66000000-0000-4000-8000-000000000001',repeat('6',64),'68000000-0000-4000-8000-000000000001','The room is approximately 20 square metres.'),'customer response is linked transactionally');
select is((select status from public.requests where id='67000000-0000-4000-8000-000000000001'),'new','customer response returns the same request to new');
set local role authenticated;
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.request_more_information('67000000-0000-4000-8000-000000000002','Tell us more',now())$$,'P0002',null,'cross-tenant request-information action is rejected');

select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.transition_request_status('67000000-0000-4000-8000-000000000001','awaiting_assessment','Begin assessment',(select updated_at from public.requests where id='67000000-0000-4000-8000-000000000001'))$$,'42501',null,'technical officer cannot perform intake transition');
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.audit_events where entity_id='67000000-0000-4000-8000-000000000001' and action='request.status_changed'),5::bigint,'forbidden transition creates no audit event');

select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.requests),0::bigint,'viewer cannot read operational requests');

reset role;
select * from finish();
rollback;

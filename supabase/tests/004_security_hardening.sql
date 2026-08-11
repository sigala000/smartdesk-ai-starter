begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select ok(not has_table_privilege('anon','public.customers','SELECT'),'anon cannot list customers');
select ok(not has_table_privilege('anon','public.requests','SELECT'),'anon cannot list requests');
select is(
  (select count(*) from pg_class where oid in (select format('public.%I',tablename)::regclass from pg_tables where schemaname='public') and relrowsecurity and relforcerowsecurity),
  (select count(*) from pg_tables where schemaname='public'),
  'all application tables force RLS'
);
select ok(not has_function_privilege('authenticated','private.next_request_reference(uuid,timestamptz)','EXECUTE'),'reference allocator is not client callable');

insert into public.organizations(id,name,slug,reference_prefix) values
('40000000-0000-4000-8000-000000000001','Hardening A','hardening-a','HA'),
('40000000-0000-4000-8000-000000000002','Hardening B','hardening-b','HB');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('41000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','hardening-a@example.test','',now(),now()),
('41000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','hardening-b@example.test','',now(),now()),
('41000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inactive-a@example.test','',now(),now());
insert into public.organization_members(id,organization_id,user_id,role,display_name,is_active) values
('42000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','manager','Manager A',true),
('42000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002','manager','Manager B',true),
('42000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000003','manager','Inactive A',false);
insert into public.services(id,organization_id,name) values
('43000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Hardening Service A'),
('43000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','Hardening Service B');
insert into public.customers(id,organization_id,full_name,email) values
('44000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Hardening Customer A','hardening-customer-a@example.test'),
('44000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','Hardening Customer B','hardening-customer-b@example.test');
insert into public.requests(id,organization_id,customer_id,service_id,reference_number,request_type,status,title,idempotency_key) values
('45000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001',null,'support','draft','Hardening Request A','45000000-0000-4000-8000-000000000011'),
('45000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002',null,'support','draft','Hardening Request B','45000000-0000-4000-8000-000000000012');

select throws_ok($$insert into public.assignments(organization_id,request_id,member_id) values('40000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000002')$$,'23503',null,'cross-tenant assignment is rejected');
select throws_ok($$insert into public.attachments(organization_id,request_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes) values('40000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000002','documents','40000000-0000-4000-8000-000000000001/file.pdf','file.pdf','application/pdf',100)$$,'23503',null,'cross-tenant attachment link is rejected');
select throws_ok($$insert into public.attachments(organization_id,request_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes) values('40000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','documents','40000000-0000-4000-8000-000000000002/file.pdf','file.pdf','application/pdf',100)$$,'23514',null,'attachment path must match tenant');
select throws_ok($$insert into public.request_status_history(organization_id,request_id,to_status) values('40000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','invented')$$,'23514',null,'history status is constrained');
select throws_ok($$update public.organizations set reference_prefix='HX' where id='40000000-0000-4000-8000-000000000001'$$,'22023','reference prefix is immutable after first allocation','used reference prefix cannot change');

set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.organizations),0::bigint,'inactive member sees no organization data');
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
select throws_ok($$insert into public.audit_events(organization_id,action,entity_type) values('40000000-0000-4000-8000-000000000001','fake','request')$$,'42501',null,'manager cannot fabricate audit events');
select throws_ok($$insert into public.request_status_history(organization_id,request_id,to_status) values('40000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','new')$$,'42501',null,'manager cannot fabricate status history');
select throws_ok($$insert into public.attachments(organization_id,request_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes) values('40000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','documents','40000000-0000-4000-8000-000000000001/file.pdf','file.pdf','application/pdf',100)$$,'42501',null,'authenticated manager cannot create attachment metadata directly');

reset role;
insert into public.notifications(id,organization_id,recipient_member_id,kind,title,body) values
('46000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','request_update','Original','Original body');
set local role authenticated;
select set_config('request.jwt.claim.sub','41000000-0000-4000-8000-000000000001',true);
select lives_ok($$update public.notifications set read_at=now() where id='46000000-0000-4000-8000-000000000001'$$,'recipient may mark notification read');
select throws_ok($$update public.notifications set title='Forged' where id='46000000-0000-4000-8000-000000000001'$$,'42501',null,'recipient cannot rewrite notification content');

reset role;
select * from finish();
rollback;

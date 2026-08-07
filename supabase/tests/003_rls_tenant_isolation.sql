begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.organizations(id,name,slug,reference_prefix) values
('30000000-0000-4000-8000-000000000001','Tenant A','tenant-a','TA'),
('30000000-0000-4000-8000-000000000002','Tenant B','tenant-b','TB');
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('31000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-a@example.test','',now(),now()),
('31000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','viewer-b@example.test','',now(),now());
insert into public.organization_members(id,organization_id,user_id,role,display_name) values
('32000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','admin','Admin A'),
('32000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000002','viewer','Viewer B');
insert into public.departments(id,organization_id,name) values
('33000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','A Department'),
('33000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','B Department');
insert into public.customers(id,organization_id,full_name,email) values
('34000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Customer A','a@example.test'),
('34000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Customer B','b@example.test');
insert into public.services(id,organization_id,name) values
('34500000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Service A'),
('34500000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Service B');
insert into public.requests(id,organization_id,customer_id,service_id,reference_number,request_type,status,title,idempotency_key) values
('35000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','34000000-0000-4000-8000-000000000001','34500000-0000-4000-8000-000000000001',null,'support','draft','Request A','35000000-0000-4000-8000-000000000011'),
('35000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','34000000-0000-4000-8000-000000000002','34500000-0000-4000-8000-000000000002',null,'support','draft','Request B','35000000-0000-4000-8000-000000000012');

select ok(not has_table_privilege('anon','public.organizations','SELECT'),'anonymous has no organization grant');
select ok(not has_table_privilege('anon','public.requests','SELECT'),'anonymous has no request grant');

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.organizations),1::bigint,'member sees own organization only');
select is((select count(*) from public.departments),1::bigint,'member sees own departments only');
select is((select count(*) from public.requests),1::bigint,'admin sees own requests only');
select is((select count(*) from public.customers),1::bigint,'admin sees own customers only');
update public.departments set name='Cross tenant write' where organization_id='30000000-0000-4000-8000-000000000002';
select is((select name from public.departments where id='33000000-0000-4000-8000-000000000002'),null::text,'cross-tenant update cannot observe or alter a row');
select throws_ok($$insert into public.departments(organization_id,name) values('30000000-0000-4000-8000-000000000002','Cross tenant insert')$$,'42501',null,'cross-tenant insert is rejected');

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.requests),0::bigint,'viewer cannot access operational requests');
select throws_ok($$insert into public.departments(organization_id,name) values('30000000-0000-4000-8000-000000000002','Viewer write')$$,'42501',null,'viewer cannot change configuration');

reset role;
select * from finish();
rollback;

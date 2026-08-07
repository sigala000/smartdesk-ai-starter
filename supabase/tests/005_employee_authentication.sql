begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.organizations(id,name,slug,reference_prefix) values
('50000000-0000-4000-8000-000000000001','Auth Tenant A','auth-tenant-a','AA'),
('50000000-0000-4000-8000-000000000002','Auth Tenant B','auth-tenant-b','AB');

insert into public.departments(id,organization_id,name) values
('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','Auth Department A'),
('51000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','Auth Department B');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('52000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','active-auth@example.test','',now(),now()),
('52000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inactive-auth@example.test','',now(),now()),
('52000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','no-member-auth@example.test','',now(),now()),
('52000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','multi-auth@example.test','',now(),now());

insert into public.organization_members(id,organization_id,user_id,role,department_id,display_name,is_active) values
('53000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','admin','51000000-0000-4000-8000-000000000001','Active Employee',true),
('53000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000002','manager','51000000-0000-4000-8000-000000000001','Inactive Employee',false),
('53000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000004','viewer',null,'Multi Employee A',true),
('53000000-0000-4000-8000-000000000004','50000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000004','viewer',null,'Multi Employee B',true);

select ok(not has_table_privilege('anon','public.organization_members','SELECT'),'anonymous cannot list employee memberships');

set local role authenticated;
select set_config('request.jwt.claim.sub','52000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.organizations where id='50000000-0000-4000-8000-000000000001'),1::bigint,'active employee resolves own organization');
select is((select role from public.organization_members where user_id='52000000-0000-4000-8000-000000000001'),'admin','role comes from active membership');
select is((select count(*) from public.organizations where id='50000000-0000-4000-8000-000000000002'),0::bigint,'active employee cannot resolve another tenant');
select is((select count(*) from public.departments where organization_id='50000000-0000-4000-8000-000000000002'),0::bigint,'active employee cannot resolve another tenant department');

select set_config('request.jwt.claim.sub','52000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.organization_members),0::bigint,'deactivated employee cannot read memberships');
select is((select count(*) from public.organizations),0::bigint,'deactivated employee cannot read organizations');

select set_config('request.jwt.claim.sub','52000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.organizations),0::bigint,'authenticated non-member cannot read organizations');

select set_config('request.jwt.claim.sub','52000000-0000-4000-8000-000000000004',true);
select is((select count(*) from public.organizations),2::bigint,'multi-member sees only both explicitly joined organizations');
select is((select count(distinct organization_id) from public.organization_members where user_id='52000000-0000-4000-8000-000000000004'),2::bigint,'multi-membership remains explicit for application fail-closed handling');

reset role;
select * from finish();
rollback;

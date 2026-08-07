begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public','organizations','organizations exists');
select has_table('public','requests','requests exists');
select has_table('public','request_reference_counters','reference counters exist');
select has_table('public','audit_events','audit events exist');
select col_not_null('public','requests','organization_id','requests require organization_id');
select col_not_null('public','messages','organization_id','messages require organization_id');
select col_not_null('public','knowledge_documents','organization_id','knowledge requires organization_id');
select ok((select relrowsecurity from pg_class where oid='public.requests'::regclass),'requests has RLS');
select ok((select relforcerowsecurity from pg_class where oid='public.requests'::regclass),'requests forces RLS');
select is((select count(*)::bigint from public.departments where organization_id='10000000-0000-4000-8000-000000000001'),3::bigint,'BuildPro departments seeded');
select is((select count(*)::bigint from public.services where organization_id='10000000-0000-4000-8000-000000000001'),6::bigint,'BuildPro services seeded');
select is((select count(*)::bigint from public.knowledge_documents where organization_id='10000000-0000-4000-8000-000000000001' and status='approved'),4::bigint,'approved knowledge seeded');

select * from finish();
rollback;

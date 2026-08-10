begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.customers(id,organization_id,full_name,email) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Test Customer','test@example.test');
insert into public.requests(id,organization_id,customer_id,service_id,reference_number,request_type,title,description,location,idempotency_key,confirmed_at) values
('21000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',null,'quotation','First request','First description','Douala','21000000-0000-4000-8000-000000000011',now()),
('21000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',null,'quotation','Second request','Second description','Douala','21000000-0000-4000-8000-000000000012',now());

select matches((select reference_number from public.requests where id='21000000-0000-4000-8000-000000000001'),'^BP-[0-9]{4}-[0-9]{6}$','reference format is stable');
select isnt((select reference_number from public.requests where id='21000000-0000-4000-8000-000000000001'),(select reference_number from public.requests where id='21000000-0000-4000-8000-000000000002'),'sequential allocation is unique');
select is(
  (select last_value from public.request_reference_counters where organization_id='10000000-0000-4000-8000-000000000001' order by reference_year desc limit 1),
  (select right(reference_number, 6)::bigint from public.requests where id='21000000-0000-4000-8000-000000000002'),
  'counter tracks the latest atomic allocation'
);
select lives_ok($$set constraints conversations_request_pair, requests_conversation_pair immediate$$,'deferred reciprocal checks execute for unlinked requests');
select throws_ok($$insert into public.requests(organization_id,customer_id,service_id,reference_number,request_type,title,description,location,idempotency_key,confirmed_at) values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','MANUAL-1','quotation','Invalid','Invalid','Douala','21000000-0000-4000-8000-000000000013',now())$$,'22023','request references are server generated','manual references rejected');
select throws_ok($$insert into public.requests(organization_id,customer_id,service_id,reference_number,request_type,title,description,idempotency_key,confirmed_at) values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',null,'invalid','Invalid','Invalid','21000000-0000-4000-8000-000000000014',now())$$,'23514',null,'request type constrained');

insert into public.organizations(id,name,slug,reference_prefix) values('22000000-0000-4000-8000-000000000001','Other Tenant','other-tenant','OT');
select throws_ok($$insert into public.requests(organization_id,customer_id,service_id,reference_number,request_type,status,title,idempotency_key) values('22000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001',null,'quotation','draft','Cross tenant','21000000-0000-4000-8000-000000000015')$$,'23503',null,'cross-tenant foreign key rejected');
select throws_ok($$update public.requests set organization_id='22000000-0000-4000-8000-000000000001' where id='21000000-0000-4000-8000-000000000001'$$,'22023','request identity fields are immutable','request tenant immutable');

select * from finish();
rollback;

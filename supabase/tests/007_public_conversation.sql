begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select ok(not has_table_privilege('anon','public.conversation_drafts','SELECT'),'anonymous cannot read drafts');
select ok(not has_table_privilege('anon','public.public_conversation_access','SELECT'),'anonymous cannot read access tokens');
select ok(not has_function_privilege('anon','public.confirm_public_request(uuid,text,text,uuid)','EXECUTE'),'anonymous cannot call confirmation');
select ok(not has_function_privilege('authenticated','public.confirm_public_request(uuid,text,text,uuid)','EXECUTE'),'employees cannot bypass public confirmation');

insert into public.conversations(id,organization_id,customer_id,state)
values ('81000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null,'open');
insert into public.public_conversation_access(organization_id,conversation_id,token_digest,expires_at)
values ('10000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001',repeat('a',64),now()+interval '1 hour');
insert into public.conversation_drafts(
  organization_id,conversation_id,intent,request_type,service_id,customer_name,phone,phone_confirmed_at,
  description,location,email,preferred_start_date,budget_min,budget_max,stage,summary_version,confirmation_nonce_digest,confirmation_nonce_expires_at
) values (
  '10000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','request_quotation','quotation',
  '12000000-0000-4000-8000-000000000002','Phase Four Customer','+237612345678',now(),
  'Complete renovation of a family house','Bonamoussadi, Douala',null,null,null,null,'review',1,repeat('b',64),now()+interval '10 minutes'
);

select is((select count(*) from public.requests where conversation_id='81000000-0000-4000-8000-000000000001'),0::bigint,'no request exists before confirmation');
select throws_ok($$select * from public.confirm_public_request('81000000-0000-4000-8000-000000000001',repeat('c',64),repeat('b',64),'82000000-0000-4000-8000-000000000001')$$,'P0002',null,'wrong opaque token cannot confirm');
select lives_ok($$select * from public.confirm_public_request('81000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'82000000-0000-4000-8000-000000000001')$$,'complete confirmed draft creates request');
select is((select count(*) from public.requests where conversation_id='81000000-0000-4000-8000-000000000001'),1::bigint,'confirmation creates exactly one request');
select matches((select reference_number from public.requests where conversation_id='81000000-0000-4000-8000-000000000001'),'^BP-[0-9]{4}-[0-9]{6}$','backend generated reference is returned');
select is((select source from public.request_status_history where request_id=(select request_id from public.conversations where id='81000000-0000-4000-8000-000000000001')),'public_conversation','initial history records public source');
select is((select count(*) from public.assignments where request_id=(select request_id from public.conversations where id='81000000-0000-4000-8000-000000000001')),1::bigint,'initial department routing is recorded');
select is((select count(*) from public.audit_events where entity_id=(select request_id from public.conversations where id='81000000-0000-4000-8000-000000000001') and action='request.created'),1::bigint,'request creation is audited');
select lives_ok($$select * from public.confirm_public_request('81000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'82000000-0000-4000-8000-000000000001')$$,'idempotent confirmation retry succeeds');
select is((select count(*) from public.requests where conversation_id='81000000-0000-4000-8000-000000000001'),1::bigint,'idempotent retry still has one request');
select is((select customer_id is not null and request_id is not null from public.conversations where id='81000000-0000-4000-8000-000000000001'),true,'conversation links customer and request atomically');

select * from finish();
rollback;

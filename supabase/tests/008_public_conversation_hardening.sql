begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.organizations(id,name,slug,reference_prefix)
values ('90000000-0000-4000-8000-000000000001','Other Tenant','other-tenant','OT');

insert into public.conversations(id,organization_id,customer_id,state) values
('90000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001',null,'open'),
('90000000-0000-4000-8000-000000000020','90000000-0000-4000-8000-000000000001',null,'open');
insert into public.public_conversation_access(organization_id,conversation_id,token_digest,expires_at) values
('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000010',repeat('1',64),now()+interval '1 hour'),
('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000020',repeat('2',64),now()+interval '1 hour');
insert into public.conversation_drafts(organization_id,conversation_id) values
('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000010'),
('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000020');

select throws_ok(
  $$select * from public.confirm_public_request('90000000-0000-4000-8000-000000000010',repeat('1',64),repeat('3',64),'90000000-0000-4000-8000-000000000030')$$,
  '23514', null, 'an incomplete draft cannot be confirmed');
select throws_ok(
  $$select * from public.confirm_public_request('90000000-0000-4000-8000-000000000020',repeat('1',64),repeat('3',64),'90000000-0000-4000-8000-000000000031')$$,
  'P0002', null, 'a token from another tenant cannot authorize confirmation');

select is(
  public.process_public_message(
    '90000000-0000-4000-8000-000000000010',repeat('1',64),'90000000-0000-4000-8000-000000000040',1,
    'request_quotation','Which BuildPro service do you need?','request_quotation','quotation',null,null,null,null,null,null,null,null,null,null,'choose_service',null
  ), false, 'first message is processed');
select is(
  public.process_public_message(
    '90000000-0000-4000-8000-000000000010',repeat('1',64),'90000000-0000-4000-8000-000000000040',1,
    'request_quotation','Which BuildPro service do you need?','request_quotation','quotation',null,null,null,null,null,null,null,null,null,null,'choose_service',null
  ), true, 'duplicate message is replayed');
select is((select count(*) from public.messages where conversation_id='90000000-0000-4000-8000-000000000010' and client_message_id='90000000-0000-4000-8000-000000000040'),1::bigint,'duplicate creates one customer message');
select is((select count(*) from public.messages where conversation_id='90000000-0000-4000-8000-000000000010' and reply_to_message_id is not null),1::bigint,'duplicate creates one assistant reply');
select is((select version from public.conversation_drafts where conversation_id='90000000-0000-4000-8000-000000000010'),2,'duplicate advances draft once');
select throws_ok(
  $$select public.process_public_message('90000000-0000-4000-8000-000000000010',repeat('1',64),'90000000-0000-4000-8000-000000000041',1,'late','late',null,null,null,null,null,null,null,null,null,null,null,null,'choose_service',null)$$,
  '40001', null, 'stale transition rolls back');
select is((select count(*) from public.messages where client_message_id='90000000-0000-4000-8000-000000000041'),0::bigint,'failed transition leaves no message');
select ok(not has_function_privilege('anon','public.process_public_message(uuid,text,uuid,integer,text,text,text,text,uuid,text,text,timestamptz,text,text,text,date,numeric,numeric,text,timestamptz)','EXECUTE'),'anonymous cannot invoke atomic message processing');

select * from finish();
rollback;

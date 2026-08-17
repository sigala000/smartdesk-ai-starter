begin;
create extension if not exists pgtap with schema extensions;
select plan(35);
select has_table('public','status_verification_challenges','challenge table exists');
select has_table('public','status_verification_tokens','token table exists');
select has_table('public','status_verification_events','security event table exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.status_verification_challenges'::regclass),'challenge RLS is forced');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='public.status_verification_tokens'::regclass),'token RLS is forced');
select ok(not has_table_privilege('anon','public.status_verification_challenges','SELECT'),'anon cannot list challenges');
select ok(not has_table_privilege('authenticated','public.status_verification_tokens','SELECT'),'employees cannot list public status tokens');
select ok(not has_function_privilege('anon','public.verify_status_challenge(uuid,text,text,text,uuid,uuid,integer,integer,uuid)','EXECUTE'),'anon cannot execute verification transaction');
select ok(not has_function_privilege('anon','public.consume_status_token(text,text,uuid)','EXECUTE'),'anon cannot consume status tokens');
select ok(not has_function_privilege('anon','public.find_status_target(text,text)','EXECUTE'),'anon cannot perform status target lookup');

insert into public.customers(id,organization_id,full_name,phone) values('f1000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Status Customer','+237600000099');
insert into public.requests(id,organization_id,customer_id,service_id,reference_number,request_type,status,title,description,location,idempotency_key,confirmed_at)
values('f2000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000002',null,'quotation','new','Status test','Status test description','Yaounde','f3000000-0000-4000-8000-000000000001',now());
insert into public.status_verification_challenges(id,organization_id,request_id,subject_digest,code_digest,max_attempts,expires_at,delivery_outcome)
values('f4000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),2,now()+interval '10 minutes','accepted');
select is((select success from public.verify_status_challenge('f4000000-0000-4000-8000-000000000001',repeat('c',64),repeat('d',64),null,null,null,900,900,'f5000000-0000-4000-8000-000000000001')),false,'wrong code fails');
select is((select attempt_count from public.status_verification_challenges where id='f4000000-0000-4000-8000-000000000001'),1,'failed attempt increments');
select is((select success from public.verify_status_challenge('f4000000-0000-4000-8000-000000000001',repeat('c',64),repeat('e',64),null,null,null,900,900,'f5000000-0000-4000-8000-000000000002')),false,'final wrong code fails');
select is((select state from public.status_verification_challenges where id='f4000000-0000-4000-8000-000000000001'),'locked','attempt limit locks challenge');
select is((select success from public.verify_status_challenge('f4000000-0000-4000-8000-000000000001',repeat('b',64),repeat('f',64),null,null,null,900,900,'f5000000-0000-4000-8000-000000000003')),false,'correct code cannot bypass lockout');
select is((select count(*) from public.status_verification_tokens where challenge_id='f4000000-0000-4000-8000-000000000001'),0::bigint,'locked challenge issues no token');

insert into public.status_verification_challenges(id,organization_id,request_id,subject_digest,code_digest,max_attempts,expires_at,delivery_outcome)
values('f4000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',repeat('1',64),repeat('2',64),5,now()+interval '10 minutes','accepted');
select is((select success from public.verify_status_challenge('f4000000-0000-4000-8000-000000000002',repeat('2',64),repeat('3',64),null,null,null,900,900,'f5000000-0000-4000-8000-000000000004')),true,'correct code succeeds');
select is((select count(*) from public.status_verification_tokens where challenge_id='f4000000-0000-4000-8000-000000000002'),1::bigint,'success issues one digest-only token');
select is((select success from public.verify_status_challenge('f4000000-0000-4000-8000-000000000002',repeat('2',64),repeat('4',64),null,null,null,900,900,'f5000000-0000-4000-8000-000000000005')),false,'consumed challenge cannot issue another token');
select is((select count(*) from public.status_verification_tokens where challenge_id='f4000000-0000-4000-8000-000000000002'),1::bigint,'retry still leaves one token');
select is((select count(*) from public.status_verification_events where event_type='verification_succeeded'),1::bigint,'successful verification is recorded');
select is((select count(*) from public.consume_status_token(repeat('3',64),(select reference_number from public.requests where id='f2000000-0000-4000-8000-000000000001'),'f5000000-0000-4000-8000-000000000007')),1::bigint,'valid token returns one safe projection');
select is((select count(*) from public.consume_status_token(repeat('3',64),(select reference_number from public.requests where id='f2000000-0000-4000-8000-000000000001'),'f5000000-0000-4000-8000-000000000008')),0::bigint,'consumed token cannot be replayed');
select is((select count(*) from public.status_verification_events where event_type='token_read' and trace_id='f5000000-0000-4000-8000-000000000007'),1::bigint,'successful token read is audited');
select is((select count(*) from public.status_verification_events where event_type='token_rejected' and trace_id='f5000000-0000-4000-8000-000000000008'),1::bigint,'replayed token rejection is audited');
select is((select consumed_at is not null from public.status_verification_tokens where token_digest=repeat('3',64)),true,'successful read consumes token');

insert into public.organizations(id,name,slug,reference_prefix) values('f6000000-0000-4000-8000-000000000001','Other Status Tenant','other-status-tenant','OS');
insert into public.customers(id,organization_id,full_name) values
 ('f6000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','BuildPro Conversation Customer'),
 ('f6000000-0000-4000-8000-000000000003','f6000000-0000-4000-8000-000000000001','Other Conversation Customer');
insert into public.conversations(id,organization_id,customer_id) values
 ('f6000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000002'),
 ('f6000000-0000-4000-8000-000000000005','f6000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000003');
insert into public.status_verification_challenges(id,organization_id,request_id,subject_digest,code_digest,max_attempts,expires_at,delivery_outcome)
values('f4000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',repeat('8',64),repeat('9',64),5,now()+interval '10 minutes','accepted');
select is((select success from public.verify_status_challenge('f4000000-0000-4000-8000-000000000004',repeat('9',64),repeat('a',64),repeat('b',64),'f6000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000005',900,900,'f5000000-0000-4000-8000-000000000010')),false,'another tenant conversation cannot receive a grant');
select is((select count(*) from public.status_verification_tokens where challenge_id='f4000000-0000-4000-8000-000000000004'),0::bigint,'cross-tenant verification issues no token');
select is((select success from public.verify_status_challenge('f4000000-0000-4000-8000-000000000004',repeat('9',64),repeat('c',64),repeat('d',64),'10000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000004',900,900,'f5000000-0000-4000-8000-000000000011')),true,'same-tenant conversation receives a server grant');
select is((select count(*) from public.consume_conversation_status_grant('f6000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000005',(select reference_number from public.requests where id='f2000000-0000-4000-8000-000000000001'),'f5000000-0000-4000-8000-000000000012')),0::bigint,'another tenant cannot consume the conversation grant');
select is((select count(*) from public.consume_conversation_status_grant('10000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000004',(select reference_number from public.requests where id='f2000000-0000-4000-8000-000000000001'),'f5000000-0000-4000-8000-000000000013')),1::bigint,'same-tenant conversation consumes its status grant');
select is((select count(*) from public.consume_conversation_status_grant('10000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000004',(select reference_number from public.requests where id='f2000000-0000-4000-8000-000000000001'),'f5000000-0000-4000-8000-000000000014')),0::bigint,'conversation grant is single-use');
insert into public.status_verification_challenges(id,subject_digest,code_digest,max_attempts,created_at,expires_at,delivery_outcome)
values('f4000000-0000-4000-8000-000000000003',repeat('5',64),repeat('6',64),5,now()-interval '20 minutes',now()-interval '10 minutes','synthetic');
select is((select success from public.verify_status_challenge('f4000000-0000-4000-8000-000000000003',repeat('6',64),repeat('7',64),null,null,null,900,900,'f5000000-0000-4000-8000-000000000006')),false,'expired challenge fails');
select is((select state from public.status_verification_challenges where id='f4000000-0000-4000-8000-000000000003'),'expired','expiry is persisted during verification');
select is((select count(*) from public.consume_status_token(repeat('9',64),'BP-2026-999999','f5000000-0000-4000-8000-000000000009')),0::bigint,'unknown token reveals no request');
select * from finish();
rollback;

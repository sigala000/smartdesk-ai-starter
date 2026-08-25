begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

select is((select count(*) from public.whatsapp_credential_envelopes),0::bigint,'production-safe seed has no stored WhatsApp credential');
select throws_ok($$insert into public.conversations(organization_id,channel,state) values('10000000-0000-4000-8000-000000000001','telegram','open')$$,'23514',null,'unapproved channel is rejected');
select lives_ok($$insert into public.whatsapp_accounts(id,organization_id,phone_number_id,whatsapp_business_account_id,is_test) values('c0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','12345678901','98765432101',true)$$,'test account can be configured');
select throws_ok($$insert into public.whatsapp_accounts(organization_id,phone_number_id,whatsapp_business_account_id,is_test,mode) values('10000000-0000-4000-8000-000000000001','22345678901','98765432101',false,'developer_test')$$,'23514',null,'account mode and legacy test flag cannot disagree');
select throws_ok($$insert into public.whatsapp_accounts(organization_id,phone_number_id,whatsapp_business_account_id) values('10000000-0000-4000-8000-000000000001','12345678901','88765432101')$$,'23505',null,'destination phone number is globally unique');
insert into public.whatsapp_developer_test_recipients(organization_id,whatsapp_account_id,wa_id)
values('10000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','237600000001');

create temporary table first_ingest as select * from public.ingest_whatsapp_text_message(
  '12345678901','98765432101','237600000001','Test Customer','wamid.inbound.1',now(),'c1000000-0000-4000-8000-000000000001',repeat('a',64),'c2000000-0000-4000-8000-000000000001');
select ok((select created from first_ingest),'first delivery is created');
select is((select organization_id from first_ingest),'10000000-0000-4000-8000-000000000001'::uuid,'tenant comes from configured destination');
select is((select channel from public.conversations where id=(select conversation_id from first_ingest)),'whatsapp','mapped conversation uses WhatsApp channel');
select is((select count(*) from public.whatsapp_identities where wa_id='237600000001'),1::bigint,'sender maps to one customer identity');
select is((select count(*) from public.whatsapp_conversations where conversation_id=(select conversation_id from first_ingest)),1::bigint,'sender maps to one active conversation');
select is((select count(*) from public.messages where conversation_id=(select conversation_id from first_ingest)),0::bigint,'ingestion commits before application message processing');

create temporary table duplicate_ingest as select * from public.ingest_whatsapp_text_message(
  '12345678901','98765432101','237600000001','Forged Name','wamid.inbound.1',now(),'c1000000-0000-4000-8000-000000000099',repeat('b',64),'c2000000-0000-4000-8000-000000000099');
select isnt((select created from duplicate_ingest),true,'provider retry is a duplicate');
select is((select delivery_id from duplicate_ingest),(select delivery_id from first_ingest),'duplicate resolves the original delivery');
select ok(public.claim_whatsapp_delivery('10000000-0000-4000-8000-000000000001',(select delivery_id from first_ingest)),'first worker claims delivery');
select isnt(public.claim_whatsapp_delivery('10000000-0000-4000-8000-000000000001',(select delivery_id from first_ingest)),true,'concurrent worker cannot claim delivery');
select ok(public.release_whatsapp_delivery('10000000-0000-4000-8000-000000000001',(select delivery_id from first_ingest),'test_retry'),'recoverable failure releases the processing claim');
select ok(public.claim_whatsapp_delivery('10000000-0000-4000-8000-000000000001',(select delivery_id from first_ingest)),'released delivery can be claimed again');

select throws_ok($$set local role anon; select * from public.whatsapp_accounts$$,'42501',null,'anonymous cannot read WhatsApp configuration');
select throws_ok($$set local role authenticated; select public.claim_whatsapp_delivery('10000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001')$$,'42501',null,'authenticated users cannot execute delivery claims');
reset role;

insert into public.organizations(id,name,slug,reference_prefix) values('c9000000-0000-4000-8000-000000000001','Foreign Tenant','whatsapp-foreign','WF');
select throws_ok($$insert into public.whatsapp_identities(organization_id,whatsapp_account_id,wa_id,customer_id) select 'c9000000-0000-4000-8000-000000000001',id,'237600000099',(select customer_id from public.whatsapp_identities limit 1) from public.whatsapp_accounts where id='c0000000-0000-4000-8000-000000000001'$$,'23503',null,'cross-tenant identity mapping is rejected');
select isnt(public.release_whatsapp_delivery('c9000000-0000-4000-8000-000000000001',(select delivery_id from first_ingest),'foreign_retry'),true,'foreign tenant cannot release an inbound delivery');
select is((select count(*) from public.claim_whatsapp_outbound('c9000000-0000-4000-8000-000000000001',(select delivery_id from first_ingest))),0::bigint,'foreign tenant cannot claim an outbound delivery');

insert into public.messages(id,organization_id,conversation_id,sender_type,client_message_id,content) values(
  'c4000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',(select conversation_id from first_ingest),'customer','c1000000-0000-4000-8000-000000000001','Hello');
insert into public.messages(id,organization_id,conversation_id,sender_type,reply_to_message_id,content) values(
  'c4000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',(select conversation_id from first_ingest),'assistant','c4000000-0000-4000-8000-000000000001','Welcome');
select ok(public.complete_whatsapp_delivery('10000000-0000-4000-8000-000000000001',(select delivery_id from first_ingest),'c4000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000002') is not null,'completion creates an outbound intent');
select is((select count(*) from public.whatsapp_message_deliveries where direction='outbound' and whatsapp_account_id='c0000000-0000-4000-8000-000000000001'),1::bigint,'one reply creates one outbound intent');
select is((select message_content from public.claim_whatsapp_outbound('10000000-0000-4000-8000-000000000001',(select delivery_id from first_ingest))),'Welcome','outbound claim returns only the persisted reply');
select isnt((select count(*) from public.claim_whatsapp_outbound('10000000-0000-4000-8000-000000000001',(select delivery_id from first_ingest))),1::bigint,'concurrent outbound worker cannot claim the same reply');
select ok(public.record_whatsapp_send_result('10000000-0000-4000-8000-000000000001',(select id from public.whatsapp_message_deliveries where direction='outbound' and whatsapp_account_id='c0000000-0000-4000-8000-000000000001'),'sent','wamid.outbound.1',null),'provider success is recorded from sending state');
select isnt(public.record_whatsapp_send_result('10000000-0000-4000-8000-000000000001',(select id from public.whatsapp_message_deliveries where direction='outbound' and whatsapp_account_id='c0000000-0000-4000-8000-000000000001'),'sent','wamid.outbound.2',null),true,'send result cannot be overwritten after completion');
select ok(public.update_whatsapp_delivery_status('12345678901','wamid.outbound.1','read',null),'read status is accepted');
select isnt(public.update_whatsapp_delivery_status('12345678901','wamid.outbound.1','sent',null),true,'late sent status cannot regress read');
select is((select status from public.whatsapp_message_deliveries where direction='outbound' and whatsapp_account_id='c0000000-0000-4000-8000-000000000001'),'read','delivery remains read');
update public.public_conversation_access set read_disabled_at=now() where conversation_id=(select conversation_id from first_ingest);
select ok(public.restore_whatsapp_conversation_access('10000000-0000-4000-8000-000000000001',(select conversation_id from first_ingest)),'mapped WhatsApp access can be restored after request confirmation');
select is((select read_disabled_at from public.public_conversation_access where conversation_id=(select conversation_id from first_ingest)),null::timestamptz,'restored access remains server-only and active');
select throws_ok($$set local role authenticated; select public.record_whatsapp_send_result('10000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','sent','wamid.bad',null)$$,'42501',null,'authenticated users cannot record provider send results');
reset role;

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

select has_column('public','organizations','lifecycle_status','organization lifecycle is versioned');
select has_table('public','organization_subscriptions','subscription foundation exists');
select has_table('public','whatsapp_credential_envelopes','credential envelopes exist');
select has_table('public','whatsapp_developer_test_recipients','test allowlist exists');
select has_table('public','meta_embedded_signup_attempts','embedded signup state exists');
select has_table('public','organization_invitations','employee invitations exist');
select has_table('public','whatsapp_suppressions','tenant suppression records exist');
select has_table('public','whatsapp_message_templates','message template foundation exists');
select has_table('public','organization_retention_settings','retention configuration foundation exists');

select is((select status from public.organization_subscriptions where organization_id='10000000-0000-4000-8000-000000000001'),'active','existing BuildPro remains active');
select is((select lifecycle_status from public.organizations where id='10000000-0000-4000-8000-000000000001'),'active','existing tenant remains active');

insert into public.whatsapp_accounts(id,organization_id,phone_number_id,whatsapp_business_account_id,is_test,mode,connection_status)
values('f0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','55555111111','55555222222',true,'developer_test','connected');
insert into public.whatsapp_developer_test_recipients(organization_id,whatsapp_account_id,wa_id)
values('10000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','237600000001'),
      ('10000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','237600000002');
select is((select count(*) from public.resolve_whatsapp_account('55555111111','55555222222','237600000001')),1::bigint,'first developer recipient resolves');
select is((select count(*) from public.resolve_whatsapp_account('55555111111','55555222222','237600000002')),1::bigint,'second developer recipient resolves');
select isnt((select recipient_allowed from public.resolve_whatsapp_account('55555111111','55555222222','237600000099')),true,'unlisted developer recipient is denied');

insert into public.organizations(id,name,slug,reference_prefix,lifecycle_status) values('f1000000-0000-4000-8000-000000000001','Phase Ten Tenant','phase-ten-tenant','P10','active');
insert into public.organization_subscriptions(organization_id,status,trial_ends_at,feature_entitlements)
values('f1000000-0000-4000-8000-000000000001','trialing',now()+interval '14 days','{"whatsapp":true,"web_chat":true}'::jsonb);
insert into public.whatsapp_accounts(id,organization_id,phone_number_id,whatsapp_business_account_id,is_test,mode,connection_status)
values('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','66666111111','66666222222',false,'production','connected');
select ok((select recipient_allowed from public.resolve_whatsapp_account('66666111111','66666222222','237600000099')),'production customer is not restricted by developer allowlist');
select throws_ok($$insert into public.whatsapp_accounts(organization_id,phone_number_id,whatsapp_business_account_id,is_test,mode) values('10000000-0000-4000-8000-000000000001','66666111111','77777222222',false,'production')$$,'23505',null,'phone asset cannot be connected to two tenants');
select throws_ok($$insert into public.whatsapp_accounts(organization_id,phone_number_id,whatsapp_business_account_id,is_test,mode) values('10000000-0000-4000-8000-000000000001','77777111111','66666222222',false,'production')$$,'23514','whatsapp_waba_tenant_mismatch','WABA asset cannot be connected across tenants');
select throws_ok($$insert into public.whatsapp_credential_envelopes(organization_id,whatsapp_account_id,key_version,ciphertext,initialization_vector,authentication_tag) values('10000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',1,repeat('a',32),repeat('b',16),repeat('c',16))$$,'23503',null,'credential cannot cross tenant account boundary');
select ok(public.record_whatsapp_opt_out('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001',repeat('d',64),'f5000000-0000-4000-8000-000000000001'),'opt-out is recorded through service-only function');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at) values
('f3000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase10-a@example.test','',now(),now()),
('f3000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase10-b@example.test','',now(),now());
set local role authenticated;
select set_config('request.jwt.claim.sub','f3000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.create_owner_organization('Unverified Company','unverified-company','UNV','Unverified Owner',14)$$,'42501','verified_authentication_required','unverified owner cannot create a tenant');
reset role;
insert into public.organization_members(id,organization_id,user_id,role,display_name) values
('f4000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','admin','Phase Ten A'),
('f4000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000002','admin','Phase Ten B');
set local role authenticated;
select set_config('request.jwt.claim.sub','f3000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.organization_subscriptions),1::bigint,'tenant A sees only its subscription');
select is((select count(*) from public.whatsapp_developer_test_recipients),2::bigint,'tenant A sees only its own test recipients');
reset role;

set local role anon;
select throws_ok($$select * from public.whatsapp_credential_envelopes$$,'42501',null,'anonymous cannot read credentials');
reset role;
set local role authenticated;
select throws_ok($$select * from public.whatsapp_credential_envelopes$$,'42501',null,'employees cannot read credentials');
select throws_ok($$select * from public.meta_embedded_signup_attempts$$,'42501',null,'employees cannot read signup state directly');
reset role;

update public.organization_subscriptions set status='suspended' where organization_id='f1000000-0000-4000-8000-000000000001';
select is((select count(*) from public.resolve_whatsapp_account('66666111111','66666222222','237600000099')),0::bigint,'suspended tenant cannot receive new WhatsApp turns');
update public.organizations set lifecycle_status='onboarding' where id='10000000-0000-4000-8000-000000000001';
select throws_ok($$select * from public.create_public_conversation('buildpro-cameroon',repeat('a',64))$$,'P0002','organization_not_found','onboarding tenant cannot open public chat');

select * from finish();
rollback;

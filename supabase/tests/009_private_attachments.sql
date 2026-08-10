begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select ok((select not public from storage.buckets where id='private-attachments'),'attachment bucket is private');
select is((select file_size_limit from storage.buckets where id='private-attachments'),10485760::bigint,'bucket has 10 MiB limit');
select is((select allowed_mime_types from storage.buckets where id='private-attachments'),array['image/jpeg','image/png','application/pdf']::text[],'bucket has exact MIME allowlist');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and roles::text like '%anon%'),0::bigint,'no anonymous storage object policy exists');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and roles::text like '%authenticated%'),0::bigint,'no authenticated storage object policy exists');

insert into public.organizations(id,name,slug,reference_prefix) values
('a0000000-0000-4000-8000-000000000001','Attachment A','attachment-a','AA'),
('a0000000-0000-4000-8000-000000000002','Attachment B','attachment-b','AB');
insert into public.conversations(id,organization_id,state) values
('a1000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','open'),
('a1000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','open');

select throws_ok($$insert into public.attachments(id,organization_id,conversation_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes,upload_status,upload_expires_at,uploaded_by_type)
values('a2000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','private-attachments','a0000000-0000-4000-8000-000000000001/conversation/a1000000-0000-4000-8000-000000000002/a2000000-0000-4000-8000-000000000001.pdf','x.pdf','application/pdf',5,'pending',now()+interval '10 min','customer')$$,'23503',null,'cross-tenant conversation is rejected');
select throws_ok($$insert into public.attachments(id,organization_id,conversation_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes,upload_status,upload_expires_at,uploaded_by_type)
values('a2000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','other','a0000000-0000-4000-8000-000000000001/x.pdf','x.pdf','application/pdf',5,'pending',now()+interval '10 min','customer')$$,'23514',null,'non-private bucket is rejected');
select throws_ok($$insert into public.attachments(id,organization_id,conversation_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes,upload_status,upload_expires_at,uploaded_by_type)
values('a2000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','private-attachments','a0000000-0000-4000-8000-000000000001/x.svg','x.svg','image/svg+xml',5,'pending',now()+interval '10 min','customer')$$,'23514',null,'unsupported MIME is rejected');
select throws_ok($$insert into public.attachments(id,organization_id,conversation_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes,upload_status,upload_expires_at,uploaded_by_type)
values('a2000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','private-attachments','a0000000-0000-4000-8000-000000000001/x.pdf','x.pdf','application/pdf',52428801,'pending',now()+interval '10 min','customer')$$,'23514',null,'database hard file limit applies');
select lives_ok($$insert into public.attachments(id,organization_id,conversation_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes,upload_status,upload_expires_at,uploaded_by_type)
values('a2000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','private-attachments','a0000000-0000-4000-8000-000000000001/conversation/a1000000-0000-4000-8000-000000000001/a2000000-0000-4000-8000-000000000005.pdf','customer plan.pdf','application/pdf',5,'pending',now()+interval '10 min','customer')$$,'valid pending customer attachment is accepted');
select is((select upload_status from public.attachments where id='a2000000-0000-4000-8000-000000000005'),'pending','pending attachment is not active');

select throws_ok($$set local role anon; select count(*) from public.attachments where id='a2000000-0000-4000-8000-000000000005'$$,'42501',null,'anonymous cannot read attachment metadata');
select throws_ok($$set local role anon; update public.attachments set upload_status='active' where id='a2000000-0000-4000-8000-000000000005'$$,'42501',null,'anonymous cannot activate attachments');
reset role;

update public.attachments set upload_status='active',upload_expires_at=null,completed_at=now() where id='a2000000-0000-4000-8000-000000000005';
insert into public.customers(id,organization_id,full_name) values('a3000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Customer');
insert into public.departments(id,organization_id,name) values('a3100000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Attachments');
insert into public.services(id,organization_id,department_id,name) values('a3200000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a3100000-0000-4000-8000-000000000001','Attachment service');
insert into public.requests(id,organization_id,customer_id,conversation_id,service_id,department_id,reference_number,request_type,status,title,description,location,idempotency_key,confirmed_at) values('a4000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a3200000-0000-4000-8000-000000000001','a3100000-0000-4000-8000-000000000001',null,'quotation','new','Test','Test request','Douala','a4100000-0000-4000-8000-000000000001',now());
update public.conversations set request_id='a4000000-0000-4000-8000-000000000001' where id='a1000000-0000-4000-8000-000000000001';
select is((select request_id from public.attachments where id='a2000000-0000-4000-8000-000000000005'),'a4000000-0000-4000-8000-000000000001'::uuid,'confirmation trigger links active attachment');
select is((select conversation_id from public.attachments where id='a2000000-0000-4000-8000-000000000005'),'a1000000-0000-4000-8000-000000000001'::uuid,'conversation provenance is retained');
select throws_ok($$update public.attachments set request_id=null,conversation_id='a1000000-0000-4000-8000-000000000002' where id='a2000000-0000-4000-8000-000000000005'$$,'23503',null,'cross-tenant retargeting is rejected');
select is((select count(*) from pg_policies where schemaname='storage' and tablename='objects' and (roles::text like '%anon%' or roles::text like '%authenticated%')),0::bigint,'no broad storage object policies exist');
select has_index('public','attachments','attachments_client_upload_unique','attachment idempotency index exists');
select has_index('public','attachments','attachments_cleanup_idx','attachment cleanup index exists');

select * from finish();
rollback;

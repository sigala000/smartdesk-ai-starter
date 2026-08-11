begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.organizations(id,name,slug,reference_prefix) values
('b0000000-0000-4000-8000-000000000001','Attachment hardening A','attachment-hardening-a','HA'),
('b0000000-0000-4000-8000-000000000002','Attachment hardening B','attachment-hardening-b','HB');
insert into public.departments(id,organization_id,name) values
('b0100000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Support');
insert into public.services(id,organization_id,department_id,name) values
('b0200000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','b0100000-0000-4000-8000-000000000001','Inspection');
insert into public.customers(id,organization_id,full_name) values
('b0300000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Hardening Customer');
insert into public.conversations(id,organization_id,state) values
('b1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','open');
insert into public.requests(id,organization_id,customer_id,conversation_id,service_id,department_id,request_type,status,title,description,location,idempotency_key,confirmed_at)
values('b2000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','b0300000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','b0200000-0000-4000-8000-000000000001','b0100000-0000-4000-8000-000000000001','quotation','new','Hardening','Hardening request','Douala','b2100000-0000-4000-8000-000000000001',now());
insert into public.attachments(id,organization_id,conversation_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes,upload_status,upload_expires_at,uploaded_by_type,client_upload_id)
values('b3000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','private-attachments','b0000000-0000-4000-8000-000000000001/conversation/b1000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000001.pdf','plan.pdf','application/pdf',12,'pending',now()+interval '10 minutes','customer','b3100000-0000-4000-8000-000000000001');

select throws_ok(
  $$update public.conversations set request_id='b2000000-0000-4000-8000-000000000001' where id='b1000000-0000-4000-8000-000000000001'$$,
  '55000','attachment_upload_in_progress','request confirmation is blocked during a customer upload'
);
update public.attachments set upload_status='validating' where id='b3000000-0000-4000-8000-000000000001';
select throws_ok(
  $$update public.conversations set request_id='b2000000-0000-4000-8000-000000000001' where id='b1000000-0000-4000-8000-000000000001'$$,
  '55000','attachment_upload_in_progress','request confirmation is blocked during validation'
);
select lives_ok(
  $$select public.activate_private_attachment('b0000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',12,repeat('a',64))$$,
  'service activation succeeds before confirmation'
);
select is((select upload_status from public.attachments where id='b3000000-0000-4000-8000-000000000001'),'active','atomic activation marks the attachment active');
select lives_ok(
  $$update public.conversations set request_id='b2000000-0000-4000-8000-000000000001' where id='b1000000-0000-4000-8000-000000000001'$$,
  'confirmation succeeds after activation'
);
select is((select request_id from public.attachments where id='b3000000-0000-4000-8000-000000000001'),'b2000000-0000-4000-8000-000000000001'::uuid,'confirmed request is linked atomically');
select throws_ok(
  $$insert into public.attachments(id,organization_id,conversation_id,storage_bucket,storage_path,original_filename,mime_type,size_bytes,upload_status,upload_expires_at,uploaded_by_type,client_upload_id) values('b3000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','private-attachments','b0000000-0000-4000-8000-000000000001/conversation/b1000000-0000-4000-8000-000000000001/b3000000-0000-4000-8000-000000000002.pdf','late.pdf','application/pdf',12,'pending',now()+interval '10 minutes','customer','b3100000-0000-4000-8000-000000000002')$$,
  '23514','attachment_conversation_confirmed','late customer upload cannot become an orphan'
);
select throws_ok(
  $$select public.activate_private_attachment('b0000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001',12,repeat('a',64))$$,
  'P0002','attachment_not_found','activation cannot cross organization boundaries'
);

select * from finish();
rollback;

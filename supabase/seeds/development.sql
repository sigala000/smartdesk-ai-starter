-- Development-only operational fixtures. This file is intentionally absent from
-- config.toml db.seed.sql_paths and must only be run through the guarded npm script.
insert into public.customers(id,organization_id,full_name,email,phone,consent_to_contact) values
('14000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Sample Customer','sample.customer@example.test','+237600000000',true)
on conflict (id) do nothing;

insert into public.requests(id,organization_id,customer_id,service_id,department_id,reference_number,request_type,status,title,description,location,idempotency_key,confirmed_at)
values ('15000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000006','11000000-0000-4000-8000-000000000001',null,'site_visit','new','Sample site inspection request','Development-only sample request.','Development site','15000000-0000-4000-8000-000000000002',now())
on conflict (id) do nothing;

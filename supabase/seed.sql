-- Production-safe reference data only. No users, customers, conversations, or requests.
insert into public.organizations(id,name,slug,reference_prefix,timezone,default_language)
values ('10000000-0000-4000-8000-000000000001','BuildPro Cameroon','buildpro-cameroon','BP','Africa/Douala','en')
on conflict (id) do update set name=excluded.name,slug=excluded.slug,reference_prefix=excluded.reference_prefix,timezone=excluded.timezone,default_language=excluded.default_language;

insert into public.departments(id,organization_id,name,description) values
('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Commercial Department','Handles customer enquiries and quotation follow-up.'),
('11000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Technical Department','Handles technical assessment and delivery planning.'),
('11000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Customer Support','Handles support, complaints, and human handoffs.')
on conflict (id) do update set name=excluded.name,description=excluded.description;

insert into public.services(id,organization_id,department_id,name,description) values
('12000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','Building construction','Construction project enquiries requiring assessment before quotation.'),
('12000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','House renovation','Renovation enquiries assessed according to the property and requested work.'),
('12000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','Electrical installation','Electrical installation enquiries reviewed by the technical team.'),
('12000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','Plumbing','Plumbing service enquiries reviewed before scheduling or quotation.'),
('12000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002','Painting','Painting enquiries assessed according to scope and site conditions.'),
('12000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','Site inspection','A site inspection may be proposed when information is insufficient for assessment.')
on conflict (id) do update set department_id=excluded.department_id,name=excluded.name,description=excluded.description;

insert into public.knowledge_documents(id,organization_id,title,content,document_type,status,approved_at) values
('13000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','How do I request a quotation?','Provide your contact details, project location, service needed, and a short description. BuildPro Cameroon reviews the request before preparing any quotation.','faq','approved','2026-08-06T00:00:00Z'),
('13000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Does BuildPro provide instant prices?','No. Prices are not generated automatically. A team member assesses the request and may ask for more information or propose a site inspection.','faq','approved','2026-08-06T00:00:00Z'),
('13000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','What information helps with an assessment?','The project location, type of work, approximate scope, preferred timing, and relevant photos or documents help the team assess a request.','faq','approved','2026-08-06T00:00:00Z'),
('13000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Can I speak with a person?','Yes. Customers may request a human handoff. Safety concerns, disputes, and uncertain requests are escalated to an employee.','faq','approved','2026-08-06T00:00:00Z')
on conflict (id) do update set title=excluded.title,content=excluded.content,status=excluded.status;

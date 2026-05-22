-- Restore storage.objects RLS policies dropped during the 2026-05-17 Mumbai cutover.
-- Buckets and data carried over but 9 of 10 buckets had zero policies, so all
-- authenticated uploads (bulk imports, chat, client docs, email, import-files,
-- org logos, ticket attachments, escalation attachments, WA templates) failed
-- with RLS errors. attendance-photos already restored in 20260518093000.

-- =====================================================================
-- org-logos  (from 20251006092448)
-- =====================================================================
DROP POLICY IF EXISTS "Users can upload org logos" ON storage.objects;
CREATE POLICY "Users can upload org logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'org-logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Logos are publicly accessible" ON storage.objects;
CREATE POLICY "Logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "Users can update org logos" ON storage.objects;
CREATE POLICY "Users can update org logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'org-logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete org logos" ON storage.objects;
CREATE POLICY "Users can delete org logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'org-logos' AND auth.role() = 'authenticated');

-- =====================================================================
-- bulk-imports  (from 20251013123812)
-- =====================================================================
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bulk-imports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'bulk-imports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Service role can manage all files" ON storage.objects;
CREATE POLICY "Service role can manage all files"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'bulk-imports');

-- =====================================================================
-- email-attachments  (from 20251016155320)
-- =====================================================================
DROP POLICY IF EXISTS "Users can upload email attachments in their org" ON storage.objects;
CREATE POLICY "Users can upload email attachments in their org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'email-attachments' AND
  (storage.foldername(name))[1] = (SELECT org_id::text FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can view email attachments in their org" ON storage.objects;
CREATE POLICY "Users can view email attachments in their org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'email-attachments' AND
  (storage.foldername(name))[1] = (SELECT org_id::text FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete email attachments in their org" ON storage.objects;
CREATE POLICY "Users can delete email attachments in their org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'email-attachments' AND
  (storage.foldername(name))[1] = (SELECT org_id::text FROM public.profiles WHERE id = auth.uid())
);

-- =====================================================================
-- import-files  (from 20251118031147 superseded by 20251118035221 — org-scoped)
-- =====================================================================
DROP POLICY IF EXISTS "Users can upload import files to their org" ON storage.objects;
CREATE POLICY "Users can upload import files to their org"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'import-files'
  AND (storage.foldername(name))[1] = (
    SELECT org_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can read import files in their org" ON storage.objects;
CREATE POLICY "Users can read import files in their org"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'import-files'
  AND (storage.foldername(name))[1] = (
    SELECT org_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete import files in their org" ON storage.objects;
CREATE POLICY "Users can delete import files in their org"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'import-files'
  AND (storage.foldername(name))[1] = (
    SELECT org_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- =====================================================================
-- client-documents  (from 20251203070554)
-- =====================================================================
DROP POLICY IF EXISTS "Users can upload client documents" ON storage.objects;
CREATE POLICY "Users can upload client documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'client-documents' AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can view client documents in their org" ON storage.objects;
CREATE POLICY "Users can view client documents in their org" ON storage.objects
FOR SELECT USING (
  bucket_id = 'client-documents' AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can delete their uploaded documents" ON storage.objects;
CREATE POLICY "Users can delete their uploaded documents" ON storage.objects
FOR DELETE USING (
  bucket_id = 'client-documents' AND auth.uid() IS NOT NULL
);

-- =====================================================================
-- chat-attachments  (from 20260205040201)
-- =====================================================================
DROP POLICY IF EXISTS "Users can upload chat attachments" ON storage.objects;
CREATE POLICY "Users can upload chat attachments" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'chat-attachments' AND
  auth.uid() IS NOT NULL AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can view chat attachments" ON storage.objects;
CREATE POLICY "Users can view chat attachments" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can delete their own chat attachments" ON storage.objects;
CREATE POLICY "Users can delete their own chat attachments" ON storage.objects
FOR DELETE USING (
  bucket_id = 'chat-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- =====================================================================
-- ticket-attachments  (from 20260218050112)
-- =====================================================================
DROP POLICY IF EXISTS "Anyone can upload ticket attachments" ON storage.objects;
CREATE POLICY "Anyone can upload ticket attachments" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'ticket-attachments');

DROP POLICY IF EXISTS "Anyone can view ticket attachments" ON storage.objects;
CREATE POLICY "Anyone can view ticket attachments" ON storage.objects
FOR SELECT USING (bucket_id = 'ticket-attachments');

-- =====================================================================
-- ticket-escalation-attachments  (from 20260220084756)
-- =====================================================================
DROP POLICY IF EXISTS "Authenticated users can upload escalation attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload escalation attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ticket-escalation-attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can view escalation attachments" ON storage.objects;
CREATE POLICY "Anyone can view escalation attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-escalation-attachments');

-- =====================================================================
-- whatsapp-templates  (bucket from 20251010045038 — no original policies
-- ever existed in migrations; bucket is public so reads work without policy,
-- but admin uploads need an INSERT policy).
-- =====================================================================
DROP POLICY IF EXISTS "Anyone can view whatsapp templates" ON storage.objects;
CREATE POLICY "Anyone can view whatsapp templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-templates');

DROP POLICY IF EXISTS "Authenticated users can upload whatsapp templates" ON storage.objects;
CREATE POLICY "Authenticated users can upload whatsapp templates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'whatsapp-templates');

DROP POLICY IF EXISTS "Authenticated users can update whatsapp templates" ON storage.objects;
CREATE POLICY "Authenticated users can update whatsapp templates"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'whatsapp-templates');

DROP POLICY IF EXISTS "Authenticated users can delete whatsapp templates" ON storage.objects;
CREATE POLICY "Authenticated users can delete whatsapp templates"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'whatsapp-templates');

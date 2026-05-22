-- Restore storage RLS policies for the attendance-photos bucket.
-- Path pattern: <user_id>/<YYYY-MM-DD>/<sign_in|sign_out>_<ts>.jpg
-- Each user can read/insert/update/delete files only inside their own
-- top-level folder (named after their auth.uid()). Admins and super_admins
-- can read and delete any object in the bucket (for SDR attendance reports).

DROP POLICY IF EXISTS "attendance_photos_select_own_or_admin" ON storage.objects;
CREATE POLICY "attendance_photos_select_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "attendance_photos_insert_own" ON storage.objects;
CREATE POLICY "attendance_photos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "attendance_photos_update_own" ON storage.objects;
CREATE POLICY "attendance_photos_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "attendance_photos_delete_own_or_admin" ON storage.objects;
CREATE POLICY "attendance_photos_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    )
  );

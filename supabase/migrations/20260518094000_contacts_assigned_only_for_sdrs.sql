-- Tighten contacts visibility: SDRs (and any non-manager role) only see and
-- update contacts assigned to them; managers/admins keep org-wide access for
-- oversight and bulk-assignment workflows.

DROP POLICY IF EXISTS "Users can view contacts in their org" ON public.contacts;
CREATE POLICY "Users can view contacts in their org" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id = public.get_user_org_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'sales_manager'::public.app_role)
      OR public.has_role(auth.uid(), 'support_manager'::public.app_role)
      OR assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update contacts in their org" ON public.contacts;
CREATE POLICY "Users can update contacts in their org" ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id = public.get_user_org_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'sales_manager'::public.app_role)
      OR public.has_role(auth.uid(), 'support_manager'::public.app_role)
      OR assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    org_id = public.get_user_org_id(auth.uid())
  );

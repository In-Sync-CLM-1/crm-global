-- ============================================================================
-- Attendance + Leave + Regularization
-- Ported from rmpl, adapted for globalcrm's org-scoped multi-tenant model.
-- Approver model: any user with role 'admin' or 'super_admin' in the same org.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.leave_type AS ENUM (
    'sick_leave','casual_leave','earned_leave','unpaid_leave',
    'compensatory_off','maternity_leave','paternity_leave'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.regularization_type AS ENUM (
    'forgot_signin','forgot_signout','time_correction','location_issue','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.regularization_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- TABLE: attendance_policies (per org)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  policy_name TEXT NOT NULL DEFAULT 'Default',
  working_hours_per_day NUMERIC(3,1) DEFAULT 8,
  grace_period_minutes INTEGER DEFAULT 15,
  half_day_threshold_hours NUMERIC(3,1) DEFAULT 4,
  overtime_start_after_hours NUMERIC(3,1) DEFAULT 8,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_policies_org ON public.attendance_policies(org_id);
ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- TABLE: attendance_records (one per user per date per org)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sign_in_time TIMESTAMPTZ,
  sign_out_time TIMESTAMPTZ,
  total_hours NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'present',
  location_lat NUMERIC(10,7),
  location_lng NUMERIC(10,7),
  sign_in_device_info JSONB,
  sign_out_device_info JSONB,
  sign_in_photo_url TEXT,
  sign_out_photo_url TEXT,
  sign_in_location_accuracy NUMERIC,
  sign_out_location_accuracy NUMERIC,
  sign_in_location_city TEXT,
  sign_in_location_state TEXT,
  sign_out_location_city TEXT,
  sign_out_location_state TEXT,
  network_status TEXT,
  sync_status TEXT DEFAULT 'synced',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON public.attendance_records(org_id, date);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- TABLE: attendance_regularizations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_regularizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  regularization_type public.regularization_type NOT NULL,
  original_sign_in_time TIMESTAMPTZ,
  original_sign_out_time TIMESTAMPTZ,
  requested_sign_in_time TIMESTAMPTZ,
  requested_sign_out_time TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status public.regularization_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reg_user ON public.attendance_regularizations(user_id);
CREATE INDEX IF NOT EXISTS idx_reg_org_status ON public.attendance_regularizations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_reg_date ON public.attendance_regularizations(attendance_date DESC);
ALTER TABLE public.attendance_regularizations ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- TABLE: leave_applications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(4,1) NOT NULL,
  reason TEXT NOT NULL,
  status public.leave_status NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  attachments JSONB,
  sandwich_days INTEGER DEFAULT 0,
  leave_calculation JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leave_user ON public.leave_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_org_status ON public.leave_applications(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON public.leave_applications(start_date, end_date);
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- TABLE: leave_balances
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  sick_leave_balance NUMERIC(5,1) DEFAULT 12,
  sick_leave_limit NUMERIC(5,1) DEFAULT 12,
  casual_leave_balance NUMERIC(5,1) DEFAULT 12,
  casual_leave_limit NUMERIC(5,1) DEFAULT 12,
  earned_leave_balance NUMERIC(5,1) DEFAULT 15,
  earned_leave_limit NUMERIC(5,1) DEFAULT 15,
  compensatory_off_balance NUMERIC(5,1) DEFAULT 0,
  compensatory_off_limit NUMERIC(5,1) DEFAULT 0,
  maternity_leave_balance NUMERIC(5,1) DEFAULT 180,
  maternity_leave_limit NUMERIC(5,1) DEFAULT 180,
  paternity_leave_balance NUMERIC(5,1) DEFAULT 3,
  paternity_leave_limit NUMERIC(5,1) DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, year)
);
CREATE INDEX IF NOT EXISTS idx_lb_user_year ON public.leave_balances(user_id, year);
CREATE INDEX IF NOT EXISTS idx_lb_org_year ON public.leave_balances(org_id, year);
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- TABLE: leave_balance_adjustments (audit trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_balance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adjusted_by UUID NOT NULL REFERENCES auth.users(id),
  leave_type TEXT NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add','deduct')),
  days NUMERIC(5,1) NOT NULL,
  previous_balance NUMERIC(5,1),
  new_balance NUMERIC(5,1),
  reason TEXT NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lba_user_year ON public.leave_balance_adjustments(user_id, year);
ALTER TABLE public.leave_balance_adjustments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- TABLE: company_holidays (per org)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  day_of_week TEXT,
  is_optional BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, year, holiday_date, holiday_name)
);
CREATE INDEX IF NOT EXISTS idx_holidays_org_year ON public.company_holidays(org_id, year);
ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- TABLE: approval_tokens (one-time, 72h, email approve/reject)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('leave','regularization')),
  request_id UUID NOT NULL,
  approver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve','reject')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_at_token ON public.approval_tokens(token);
CREATE INDEX IF NOT EXISTS idx_at_request ON public.approval_tokens(request_type, request_id);
ALTER TABLE public.approval_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FUNCTIONS + TRIGGERS
-- ============================================================================

-- updated_at trigger fn (reuse globalcrm's update_updated_at_column if present;
-- create our own scoped one to be safe)
CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- Auto-compute total_hours and status on attendance insert/update
CREATE OR REPLACE FUNCTION public.calculate_attendance_hours()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sign_in_time IS NOT NULL AND NEW.sign_out_time IS NOT NULL THEN
    NEW.total_hours := EXTRACT(EPOCH FROM (NEW.sign_out_time - NEW.sign_in_time)) / 3600;
    IF NEW.total_hours >= 8 THEN NEW.status := 'present';
    ELSIF NEW.total_hours >= 4 THEN NEW.status := 'half_day';
    ELSE NEW.status := 'absent';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_calculate_attendance_hours ON public.attendance_records;
CREATE TRIGGER trigger_calculate_attendance_hours
BEFORE INSERT OR UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.calculate_attendance_hours();

-- Auto-apply approved regularization → upsert attendance_records
CREATE OR REPLACE FUNCTION public.apply_attendance_regularization()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_in TIMESTAMPTZ;
  v_out TIMESTAMPTZ;
  v_existing UUID;
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    v_in := COALESCE(NEW.requested_sign_in_time, NEW.original_sign_in_time);
    v_out := COALESCE(NEW.requested_sign_out_time, NEW.original_sign_out_time);

    SELECT id INTO v_existing FROM public.attendance_records
     WHERE user_id = NEW.user_id AND date = NEW.attendance_date;

    IF v_existing IS NOT NULL THEN
      UPDATE public.attendance_records
         SET sign_in_time = COALESCE(v_in, sign_in_time),
             sign_out_time = COALESCE(v_out, sign_out_time),
             notes = COALESCE(notes,'') || ' [Regularized: ' || NEW.regularization_type::TEXT || ']',
             updated_at = NOW()
       WHERE id = v_existing;
    ELSE
      INSERT INTO public.attendance_records
        (org_id, user_id, date, sign_in_time, sign_out_time, notes, status)
      VALUES
        (NEW.org_id, NEW.user_id, NEW.attendance_date, v_in, v_out,
         '[Regularized: ' || NEW.regularization_type::TEXT || '] ' || NEW.reason,
         'present');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS apply_attendance_regularization_trigger ON public.attendance_regularizations;
CREATE TRIGGER apply_attendance_regularization_trigger
AFTER UPDATE ON public.attendance_regularizations
FOR EACH ROW EXECUTE FUNCTION public.apply_attendance_regularization();

-- updated_at for regularizations
DROP TRIGGER IF EXISTS reg_updated_at ON public.attendance_regularizations;
CREATE TRIGGER reg_updated_at
BEFORE UPDATE ON public.attendance_regularizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- updated_at for policies, holidays, balances, leave_applications
DROP TRIGGER IF EXISTS policies_updated_at ON public.attendance_policies;
CREATE TRIGGER policies_updated_at BEFORE UPDATE ON public.attendance_policies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS holidays_updated_at ON public.company_holidays;
CREATE TRIGGER holidays_updated_at BEFORE UPDATE ON public.company_holidays
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS lb_updated_at ON public.leave_balances;
CREATE TRIGGER lb_updated_at BEFORE UPDATE ON public.leave_balances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS la_updated_at ON public.leave_applications;
CREATE TRIGGER la_updated_at BEFORE UPDATE ON public.leave_applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- Deduct on approve, refund on reject/cancel
CREATE OR REPLACE FUNCTION public.update_leave_balance()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.leave_balances SET
      sick_leave_balance        = CASE WHEN NEW.leave_type='sick_leave'        THEN GREATEST(0, sick_leave_balance        - NEW.total_days) ELSE sick_leave_balance        END,
      casual_leave_balance      = CASE WHEN NEW.leave_type='casual_leave'      THEN GREATEST(0, casual_leave_balance      - NEW.total_days) ELSE casual_leave_balance      END,
      earned_leave_balance      = CASE WHEN NEW.leave_type='earned_leave'      THEN GREATEST(0, earned_leave_balance      - NEW.total_days) ELSE earned_leave_balance      END,
      compensatory_off_balance  = CASE WHEN NEW.leave_type='compensatory_off'  THEN GREATEST(0, compensatory_off_balance  - NEW.total_days) ELSE compensatory_off_balance  END,
      maternity_leave_balance   = CASE WHEN NEW.leave_type='maternity_leave'   THEN GREATEST(0, maternity_leave_balance   - NEW.total_days) ELSE maternity_leave_balance   END,
      paternity_leave_balance   = CASE WHEN NEW.leave_type='paternity_leave'   THEN GREATEST(0, paternity_leave_balance   - NEW.total_days) ELSE paternity_leave_balance   END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;

  IF (NEW.status = 'cancelled' OR NEW.status = 'rejected') AND OLD.status = 'approved' THEN
    UPDATE public.leave_balances SET
      sick_leave_balance        = CASE WHEN NEW.leave_type='sick_leave'        THEN sick_leave_balance        + NEW.total_days ELSE sick_leave_balance        END,
      casual_leave_balance      = CASE WHEN NEW.leave_type='casual_leave'      THEN casual_leave_balance      + NEW.total_days ELSE casual_leave_balance      END,
      earned_leave_balance      = CASE WHEN NEW.leave_type='earned_leave'      THEN earned_leave_balance      + NEW.total_days ELSE earned_leave_balance      END,
      compensatory_off_balance  = CASE WHEN NEW.leave_type='compensatory_off'  THEN compensatory_off_balance  + NEW.total_days ELSE compensatory_off_balance  END,
      maternity_leave_balance   = CASE WHEN NEW.leave_type='maternity_leave'   THEN maternity_leave_balance   + NEW.total_days ELSE maternity_leave_balance   END,
      paternity_leave_balance   = CASE WHEN NEW.leave_type='paternity_leave'   THEN paternity_leave_balance   + NEW.total_days ELSE paternity_leave_balance   END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id AND year = EXTRACT(YEAR FROM NEW.start_date);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_leave_status_change ON public.leave_applications;
CREATE TRIGGER on_leave_status_change
AFTER UPDATE OF status ON public.leave_applications
FOR EACH ROW EXECUTE FUNCTION public.update_leave_balance();

-- Seed leave_balances for any new profile in the current year
CREATE OR REPLACE FUNCTION public.initialize_leave_balance()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.org_id IS NOT NULL THEN
    INSERT INTO public.leave_balances (org_id, user_id, year)
    VALUES (NEW.org_id, NEW.id, EXTRACT(YEAR FROM CURRENT_DATE))
    ON CONFLICT (user_id, year) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trigger_initialize_leave_balance ON public.profiles;
CREATE TRIGGER trigger_initialize_leave_balance
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.initialize_leave_balance();

-- Sandwich-leave calculator RPC (callable from frontend)
CREATE OR REPLACE FUNCTION public.calculate_sandwich_leave_days(
  p_start_date DATE,
  p_end_date DATE,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_org UUID;
  v_requested INT := 0;
  v_weekend INT := 0;
  v_holiday INT := 0;
  v_total INT := 0;
  v_cur DATE;
  v_dow INT;
  v_week INT;
  v_is_weekend BOOLEAN;
  v_is_holiday BOOLEAN;
  v_weekend_dates JSONB := '[]'::JSONB;
  v_holiday_dates JSONB := '[]'::JSONB;
  v_has_sandwich BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT org_id INTO v_user_org FROM public.profiles WHERE id = p_user_id;
  END IF;

  v_cur := p_start_date;
  WHILE v_cur <= p_end_date LOOP
    v_dow := EXTRACT(DOW FROM v_cur)::INT;
    v_week := CEIL(EXTRACT(DAY FROM v_cur)::INT / 7.0)::INT;
    v_is_weekend := (v_dow = 0) OR (v_dow = 6 AND v_week IN (2,4));
    v_is_holiday := EXISTS (
      SELECT 1 FROM public.company_holidays ch
       WHERE ch.holiday_date = v_cur
         AND (ch.is_optional IS NULL OR ch.is_optional = FALSE)
         AND (v_user_org IS NULL OR ch.org_id = v_user_org)
    );

    IF v_is_weekend OR v_is_holiday THEN
      v_has_sandwich := TRUE;
      IF v_is_weekend THEN
        v_weekend := v_weekend + 1;
        v_weekend_dates := v_weekend_dates || to_jsonb(v_cur::TEXT);
      END IF;
      IF v_is_holiday AND NOT v_is_weekend THEN
        v_holiday := v_holiday + 1;
        v_holiday_dates := v_holiday_dates || to_jsonb(v_cur::TEXT);
      END IF;
    ELSE
      v_requested := v_requested + 1;
    END IF;
    v_cur := v_cur + 1;
  END LOOP;

  v_total := v_requested + v_weekend + v_holiday;
  RETURN jsonb_build_object(
    'requested_days', v_requested,
    'weekend_days', v_weekend,
    'holiday_days', v_holiday,
    'total_deduction', v_total,
    'has_sandwich', v_has_sandwich,
    'weekend_dates', v_weekend_dates,
    'holiday_dates', v_holiday_dates
  );
END $$;

-- ============================================================================
-- RLS POLICIES — org-scoped
-- ============================================================================

-- attendance_policies: everyone in org reads; admins manage
DROP POLICY IF EXISTS ap_select_org ON public.attendance_policies;
CREATE POLICY ap_select_org ON public.attendance_policies FOR SELECT
USING (org_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS ap_admin_all ON public.attendance_policies;
CREATE POLICY ap_admin_all ON public.attendance_policies FOR ALL
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
)
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
);

-- attendance_records: user reads/writes own; admins read/write all in org
DROP POLICY IF EXISTS ar_select_own ON public.attendance_records;
CREATE POLICY ar_select_own ON public.attendance_records FOR SELECT
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (user_id = auth.uid()
       OR public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.has_role(auth.uid(),'super_admin'::public.app_role))
);

DROP POLICY IF EXISTS ar_insert_own ON public.attendance_records;
CREATE POLICY ar_insert_own ON public.attendance_records FOR INSERT
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS ar_update_own ON public.attendance_records;
CREATE POLICY ar_update_own ON public.attendance_records FOR UPDATE
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (user_id = auth.uid()
       OR public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.has_role(auth.uid(),'super_admin'::public.app_role))
)
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
);

DROP POLICY IF EXISTS ar_admin_delete ON public.attendance_records;
CREATE POLICY ar_admin_delete ON public.attendance_records FOR DELETE
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
);

-- attendance_regularizations: user CRUD own pending; admin manage all in org
DROP POLICY IF EXISTS reg_select ON public.attendance_regularizations;
CREATE POLICY reg_select ON public.attendance_regularizations FOR SELECT
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (user_id = auth.uid()
       OR public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.has_role(auth.uid(),'super_admin'::public.app_role))
);

DROP POLICY IF EXISTS reg_insert ON public.attendance_regularizations;
CREATE POLICY reg_insert ON public.attendance_regularizations FOR INSERT
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS reg_update ON public.attendance_regularizations;
CREATE POLICY reg_update ON public.attendance_regularizations FOR UPDATE
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (
    (user_id = auth.uid() AND status = 'pending')
    OR public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_role(auth.uid(),'super_admin'::public.app_role)
  )
)
WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS reg_delete_own_pending ON public.attendance_regularizations;
CREATE POLICY reg_delete_own_pending ON public.attendance_regularizations FOR DELETE
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND user_id = auth.uid() AND status = 'pending'
);

-- leave_applications
DROP POLICY IF EXISTS la_select ON public.leave_applications;
CREATE POLICY la_select ON public.leave_applications FOR SELECT
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (user_id = auth.uid()
       OR public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.has_role(auth.uid(),'super_admin'::public.app_role))
);

DROP POLICY IF EXISTS la_insert ON public.leave_applications;
CREATE POLICY la_insert ON public.leave_applications FOR INSERT
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
  AND user_id = auth.uid()
);

DROP POLICY IF EXISTS la_update ON public.leave_applications;
CREATE POLICY la_update ON public.leave_applications FOR UPDATE
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (
    (user_id = auth.uid() AND status IN ('pending','approved'))
    OR public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_role(auth.uid(),'super_admin'::public.app_role)
  )
)
WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS la_delete_own_pending ON public.leave_applications;
CREATE POLICY la_delete_own_pending ON public.leave_applications FOR DELETE
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND user_id = auth.uid() AND status = 'pending'
);

-- leave_balances: user reads own; admin manages all in org
DROP POLICY IF EXISTS lb_select ON public.leave_balances;
CREATE POLICY lb_select ON public.leave_balances FOR SELECT
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (user_id = auth.uid()
       OR public.has_role(auth.uid(),'admin'::public.app_role)
       OR public.has_role(auth.uid(),'super_admin'::public.app_role))
);

DROP POLICY IF EXISTS lb_admin_all ON public.leave_balances;
CREATE POLICY lb_admin_all ON public.leave_balances FOR ALL
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
)
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
);

-- leave_balance_adjustments: admin only
DROP POLICY IF EXISTS lba_admin ON public.leave_balance_adjustments;
CREATE POLICY lba_admin ON public.leave_balance_adjustments FOR ALL
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
)
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
);

-- company_holidays: all org members read; admin manages
DROP POLICY IF EXISTS ch_select ON public.company_holidays;
CREATE POLICY ch_select ON public.company_holidays FOR SELECT
USING (org_id = public.get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS ch_admin ON public.company_holidays;
CREATE POLICY ch_admin ON public.company_holidays FOR ALL
USING (
  org_id = public.get_user_org_id(auth.uid())
  AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'super_admin'::public.app_role))
)
WITH CHECK (
  org_id = public.get_user_org_id(auth.uid())
);

-- approval_tokens: service role only (no policies; locked down)
-- (edge function uses service_role; users never read this directly)

-- ============================================================================
-- BACKFILL: seed default attendance policy + leave balances for existing users
-- ============================================================================
DO $$ BEGIN
  INSERT INTO public.attendance_policies (org_id)
  SELECT id FROM public.organizations
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  INSERT INTO public.leave_balances (org_id, user_id, year)
  SELECT p.org_id, p.id, EXTRACT(YEAR FROM CURRENT_DATE)::INT
    FROM public.profiles p
   WHERE p.org_id IS NOT NULL
  ON CONFLICT (user_id, year) DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ============================================================================
-- FEATURE PERMISSIONS: register new features so admins can toggle them
-- ============================================================================
INSERT INTO public.feature_permissions (feature_key, feature_name, feature_description, category, is_premium) VALUES
  ('attendance', 'Attendance', 'Daily sign-in/sign-out with photo + GPS', 'hr', false),
  ('attendance_regularization', 'Attendance Regularization', 'Correction requests for missed/incorrect attendance', 'hr', false),
  ('leave_management', 'Leave Management', 'Apply for and approve leave, view balances', 'hr', false),
  ('hr_approvals', 'HR Approvals', 'Admin approve/reject leave and regularization requests', 'hr', false)
ON CONFLICT (feature_key) DO NOTHING;

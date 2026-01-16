-- ==============================================
-- Event Schedules Table
-- For ministry schedules, meeting schedules, memorial events, CO visits, etc.
-- ==============================================

-- Create enum types
DO $$ BEGIN
  CREATE TYPE public.event_type_t AS ENUM (
    'ministry',
    'meeting',
    'memorial',
    'circuit_overseer',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ministry_type_t AS ENUM (
    'house_to_house',
    'business_witnessing',
    'memorial_campaign',
    'telephone',
    'letter_writing',
    'public_witnessing',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.recurrence_pattern_t AS ENUM (
    'none',
    'weekly',
    'monthly',
    'yearly',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.event_status_t AS ENUM (
    'active',
    'cancelled',
    'completed',
    'postponed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create event_schedules table
CREATE TABLE IF NOT EXISTS public.event_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id uuid NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
  
  -- Event classification
  event_type public.event_type_t NOT NULL,
  ministry_type public.ministry_type_t, -- Only used when event_type = 'ministry'
  
  -- Basic information
  title text NOT NULL,
  description text,
  
  -- Schedule & Recurrence
  start_date date NOT NULL,
  end_date date, -- For multi-day events; null for single-day
  start_time time WITHOUT TIME ZONE, -- null if all-day event
  end_time time WITHOUT TIME ZONE, -- null if all-day event
  is_all_day boolean NOT NULL DEFAULT false,
  
  -- Recurrence settings
  recurrence_pattern public.recurrence_pattern_t NOT NULL DEFAULT 'none',
  recurrence_end_date date, -- When recurrence stops; null for indefinite
  day_of_week smallint CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)), -- 0-6, Sunday-Saturday; for weekly recurrence
  day_of_month smallint CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)), -- 1-31; for monthly recurrence
  month_of_year smallint CHECK (month_of_year IS NULL OR (month_of_year >= 1 AND month_of_year <= 12)), -- 1-12; for yearly recurrence
  recurrence_interval integer NOT NULL DEFAULT 1, -- e.g., every 2 weeks = 2
  
  -- Location
  location text,
  location_lat numeric(9,6),
  location_lng numeric(10,8),
  
  -- Status & Metadata
  status public.event_status_t NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz -- Soft delete
  
  -- Constraints
  -- Ensure ministry_type is only set when event_type is 'ministry'
  -- This will be handled via CHECK constraint or application logic
);

-- Add constraint: ministry_type should only be set when event_type = 'ministry'
ALTER TABLE public.event_schedules 
ADD CONSTRAINT event_schedules_ministry_type_check 
CHECK (
  (event_type = 'ministry' AND ministry_type IS NOT NULL) OR
  (event_type != 'ministry' AND ministry_type IS NULL)
);

-- Add constraint: end_date should be >= start_date
ALTER TABLE public.event_schedules
ADD CONSTRAINT event_schedules_date_range_check
CHECK (end_date IS NULL OR end_date >= start_date);

-- Add constraint: end_time should be >= start_time when both are set
ALTER TABLE public.event_schedules
ADD CONSTRAINT event_schedules_time_range_check
CHECK (
  start_time IS NULL OR 
  end_time IS NULL OR 
  end_time >= start_time OR
  is_all_day = true
);

-- Add constraint: recurrence_end_date should be >= start_date
ALTER TABLE public.event_schedules
ADD CONSTRAINT event_schedules_recurrence_end_check
CHECK (recurrence_end_date IS NULL OR recurrence_end_date >= start_date);

-- Create indexes
CREATE INDEX IF NOT EXISTS event_schedules_congregation_idx ON public.event_schedules(congregation_id);
CREATE INDEX IF NOT EXISTS event_schedules_event_type_idx ON public.event_schedules(event_type);
CREATE INDEX IF NOT EXISTS event_schedules_ministry_type_idx ON public.event_schedules(ministry_type) WHERE ministry_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_schedules_start_date_idx ON public.event_schedules(start_date);
CREATE INDEX IF NOT EXISTS event_schedules_status_idx ON public.event_schedules(status);
CREATE INDEX IF NOT EXISTS event_schedules_deleted_at_idx ON public.event_schedules(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_schedules_recurrence_idx ON public.event_schedules(recurrence_pattern, day_of_week, day_of_month, month_of_year) WHERE recurrence_pattern != 'none';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trg_event_schedules_updated_at ON public.event_schedules;
CREATE TRIGGER trg_event_schedules_updated_at
  BEFORE UPDATE ON public.event_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.event_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Read: Users can view events in their congregation
DROP POLICY IF EXISTS "Event schedules: read" ON public.event_schedules;
CREATE POLICY "Event schedules: read" ON public.event_schedules FOR SELECT USING (
  NOT deleted_at IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles me 
    WHERE me.id = auth.uid() 
    AND me.congregation_id = public.event_schedules.congregation_id
  )
);

-- Write: Elders and admins can create/update events in their congregation
DROP POLICY IF EXISTS "Event schedules: write" ON public.event_schedules;
CREATE POLICY "Event schedules: write" ON public.event_schedules FOR ALL USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles me 
    WHERE me.id = auth.uid() 
    AND me.congregation_id = public.event_schedules.congregation_id
    AND (
      'Elder' = ANY(me.privileges) OR
      me.role IN ('admin', 'superadmin')
    )
  )
) WITH CHECK (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM public.profiles me 
    WHERE me.id = auth.uid() 
    AND me.congregation_id = public.event_schedules.congregation_id
    AND (
      'Elder' = ANY(me.privileges) OR
      me.role IN ('admin', 'superadmin')
    )
  )
);

-- Admin override: Admins can manage all events
DROP POLICY IF EXISTS "Event schedules: admin write" ON public.event_schedules;
CREATE POLICY "Event schedules: admin write" ON public.event_schedules FOR ALL 
USING (public.is_admin(auth.uid())) 
WITH CHECK (public.is_admin(auth.uid()));

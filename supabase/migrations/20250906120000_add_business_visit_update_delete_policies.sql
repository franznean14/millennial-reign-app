-- Add RLS policies to allow UPDATE and DELETE on business_visits for active participants

-- Allow participants to UPDATE visits in their congregation
DROP POLICY IF EXISTS "Business: visit update" ON public.business_visits;
CREATE POLICY "Business: visit update" ON public.business_visits FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.business_participants bp, public.profiles me
    WHERE bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true
    AND bp.congregation_id = public.business_visits.congregation_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_participants bp, public.profiles me
    WHERE bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true
    AND bp.congregation_id = public.business_visits.congregation_id
  )
);

-- Allow participants to DELETE visits in their congregation
DROP POLICY IF EXISTS "Business: visit delete" ON public.business_visits;
CREATE POLICY "Business: visit delete" ON public.business_visits FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.business_participants bp, public.profiles me
    WHERE bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true
    AND bp.congregation_id = public.business_visits.congregation_id
  )
);



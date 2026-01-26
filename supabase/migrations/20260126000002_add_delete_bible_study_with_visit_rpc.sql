-- Delete call and remove bible study entry from daily record
CREATE OR REPLACE FUNCTION public.delete_bible_study_with_visit(
  p_visit_id uuid,
  p_visit_date date DEFAULT NULL
)
RETURNS TABLE (
  visit_id uuid,
  daily_record jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_congregation_id uuid;
  v_call public.calls%ROWTYPE;
  v_new_study text;
  v_daily public.daily_records%ROWTYPE;
  v_date date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_visit_id IS NULL THEN
    RAISE EXCEPTION 'visit_id required';
  END IF;

  SELECT congregation_id INTO v_congregation_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_congregation_id IS NULL THEN
    RAISE EXCEPTION 'User not associated with a congregation';
  END IF;

  SELECT * INTO v_call
  FROM public.calls
  WHERE id = p_visit_id
    AND congregation_id = v_congregation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found or access denied';
  END IF;

  v_date := COALESCE(p_visit_date, v_call.visit_date);
  v_new_study := 'visit:' || p_visit_id;

  DELETE FROM public.calls
  WHERE id = p_visit_id;

  UPDATE public.daily_records
    SET bible_studies = array_remove(bible_studies, v_new_study),
        updated_at = now()
  WHERE user_id = auth.uid()
    AND date = v_date
  RETURNING * INTO v_daily;

  visit_id := p_visit_id;
  daily_record := CASE WHEN v_daily.id IS NULL THEN NULL ELSE to_jsonb(v_daily) END;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_bible_study_with_visit(uuid, date) TO authenticated;

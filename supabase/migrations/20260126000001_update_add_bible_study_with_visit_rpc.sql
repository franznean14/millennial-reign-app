-- Update RPC to support client-provided visit id for offline sync
CREATE OR REPLACE FUNCTION public.add_bible_study_with_visit(
  p_visit_date date,
  p_householder_id uuid,
  p_establishment_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_visit_id uuid DEFAULT NULL
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
  v_visit_id uuid;
  v_new_study text;
  v_daily public.daily_records%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT congregation_id INTO v_congregation_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_congregation_id IS NULL THEN
    RAISE EXCEPTION 'User not associated with a congregation';
  END IF;

  IF p_householder_id IS NULL THEN
    RAISE EXCEPTION 'householder_id required';
  END IF;

  PERFORM 1
  FROM public.householders h
  LEFT JOIN public.business_establishments be ON h.establishment_id = be.id
  WHERE h.id = p_householder_id
    AND (
      (h.establishment_id IS NULL AND h.publisher_id = auth.uid())
      OR (h.establishment_id IS NOT NULL AND be.congregation_id = v_congregation_id)
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Householder not found or access denied';
  END IF;

  IF p_establishment_id IS NOT NULL THEN
    PERFORM 1
    FROM public.business_establishments
    WHERE id = p_establishment_id
      AND congregation_id = v_congregation_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Establishment not found';
    END IF;
  END IF;

  INSERT INTO public.calls (
    id,
    congregation_id,
    establishment_id,
    householder_id,
    note,
    publisher_id,
    visit_date
  )
  VALUES (
    COALESCE(p_visit_id, gen_random_uuid()),
    v_congregation_id,
    p_establishment_id,
    p_householder_id,
    p_note,
    auth.uid(),
    COALESCE(p_visit_date, CURRENT_DATE)
  )
  RETURNING id INTO v_visit_id;

  v_new_study := 'visit:' || v_visit_id;

  INSERT INTO public.daily_records (user_id, date, hours, bible_studies, note)
  VALUES (auth.uid(), COALESCE(p_visit_date, CURRENT_DATE), 0, ARRAY[v_new_study], NULL)
  ON CONFLICT (user_id, date) DO UPDATE
    SET bible_studies = CASE
        WHEN array_position(public.daily_records.bible_studies, v_new_study) IS NULL
          THEN array_append(public.daily_records.bible_studies, v_new_study)
          ELSE public.daily_records.bible_studies
        END,
        updated_at = now()
  RETURNING * INTO v_daily;

  visit_id := v_visit_id;
  daily_record := to_jsonb(v_daily);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_bible_study_with_visit(date, uuid, uuid, text, uuid) TO authenticated;

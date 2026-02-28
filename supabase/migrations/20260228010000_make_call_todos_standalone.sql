-- Make call_todos support standalone to-dos (without creating a call row)
-- Backward compatible: existing call-linked todos continue to work.

ALTER TABLE public.call_todos
  ALTER COLUMN call_id DROP NOT NULL;

ALTER TABLE public.call_todos
  ADD COLUMN IF NOT EXISTS congregation_id uuid REFERENCES public.congregations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.business_establishments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS householder_id uuid REFERENCES public.householders(id) ON DELETE SET NULL;

-- Backfill direct scope and participant fields from existing calls.
UPDATE public.call_todos t
SET
  congregation_id = c.congregation_id,
  establishment_id = c.establishment_id,
  householder_id = c.householder_id,
  publisher_id = COALESCE(t.publisher_id, c.publisher_id),
  partner_id = COALESCE(t.partner_id, c.partner_id)
FROM public.calls c
WHERE t.call_id = c.id;

CREATE INDEX IF NOT EXISTS call_todos_congregation_id_idx ON public.call_todos(congregation_id);
CREATE INDEX IF NOT EXISTS call_todos_establishment_id_idx ON public.call_todos(establishment_id) WHERE establishment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS call_todos_householder_id_idx ON public.call_todos(householder_id) WHERE householder_id IS NOT NULL;

-- RLS: allow either call-linked todos (legacy path) OR standalone todos (direct congregation path).
DROP POLICY IF EXISTS "Call todos: read" ON public.call_todos;
CREATE POLICY "Call todos: read" ON public.call_todos FOR SELECT USING (
  (
    public.call_todos.call_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.calls c, public.profiles me
      WHERE c.id = public.call_todos.call_id
        AND me.id = auth.uid()
        AND me.congregation_id = c.congregation_id
    )
  )
  OR
  (
    public.call_todos.call_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.congregation_id = public.call_todos.congregation_id
    )
  )
);

DROP POLICY IF EXISTS "Call todos: insert" ON public.call_todos;
CREATE POLICY "Call todos: insert" ON public.call_todos FOR INSERT WITH CHECK (
  (
    public.call_todos.call_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.calls c, public.business_participants bp, public.profiles me
      WHERE c.id = public.call_todos.call_id
        AND bp.user_id = auth.uid()
        AND me.id = auth.uid()
        AND me.congregation_id = bp.congregation_id
        AND bp.active = true
        AND bp.congregation_id = c.congregation_id
    )
  )
  OR
  (
    public.call_todos.call_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.business_participants bp, public.profiles me
      WHERE bp.user_id = auth.uid()
        AND me.id = auth.uid()
        AND me.congregation_id = bp.congregation_id
        AND bp.active = true
        AND bp.congregation_id = public.call_todos.congregation_id
    )
  )
);

DROP POLICY IF EXISTS "Call todos: update" ON public.call_todos;
CREATE POLICY "Call todos: update" ON public.call_todos FOR UPDATE USING (
  (
    public.call_todos.call_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.calls c, public.business_participants bp, public.profiles me
      WHERE c.id = public.call_todos.call_id
        AND bp.user_id = auth.uid()
        AND me.id = auth.uid()
        AND me.congregation_id = bp.congregation_id
        AND bp.active = true
        AND bp.congregation_id = c.congregation_id
    )
  )
  OR
  (
    public.call_todos.call_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.business_participants bp, public.profiles me
      WHERE bp.user_id = auth.uid()
        AND me.id = auth.uid()
        AND me.congregation_id = bp.congregation_id
        AND bp.active = true
        AND bp.congregation_id = public.call_todos.congregation_id
    )
  )
) WITH CHECK (
  (
    public.call_todos.call_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.calls c, public.business_participants bp, public.profiles me
      WHERE c.id = public.call_todos.call_id
        AND bp.user_id = auth.uid()
        AND me.id = auth.uid()
        AND me.congregation_id = bp.congregation_id
        AND bp.active = true
        AND bp.congregation_id = c.congregation_id
    )
  )
  OR
  (
    public.call_todos.call_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.business_participants bp, public.profiles me
      WHERE bp.user_id = auth.uid()
        AND me.id = auth.uid()
        AND me.congregation_id = bp.congregation_id
        AND bp.active = true
        AND bp.congregation_id = public.call_todos.congregation_id
    )
  )
);

DROP POLICY IF EXISTS "Call todos: delete" ON public.call_todos;
CREATE POLICY "Call todos: delete" ON public.call_todos FOR DELETE USING (
  (
    public.call_todos.call_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.calls c, public.business_participants bp, public.profiles me
      WHERE c.id = public.call_todos.call_id
        AND bp.user_id = auth.uid()
        AND me.id = auth.uid()
        AND me.congregation_id = bp.congregation_id
        AND bp.active = true
        AND bp.congregation_id = c.congregation_id
    )
  )
  OR
  (
    public.call_todos.call_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.business_participants bp, public.profiles me
      WHERE bp.user_id = auth.uid()
        AND me.id = auth.uid()
        AND me.congregation_id = bp.congregation_id
        AND bp.active = true
        AND bp.congregation_id = public.call_todos.congregation_id
    )
  )
);

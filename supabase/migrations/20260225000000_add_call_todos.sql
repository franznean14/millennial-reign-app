-- Call to-dos: multiple to-dos per call (establishment or householder)
CREATE TABLE IF NOT EXISTS public.call_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_todos_call_id_idx ON public.call_todos(call_id);

ALTER TABLE public.call_todos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Call todos: read" ON public.call_todos;
CREATE POLICY "Call todos: read" ON public.call_todos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.calls c, public.profiles me
    WHERE c.id = public.call_todos.call_id AND me.id = auth.uid() AND me.congregation_id = c.congregation_id
  )
);

DROP POLICY IF EXISTS "Call todos: insert" ON public.call_todos;
CREATE POLICY "Call todos: insert" ON public.call_todos FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.calls c, public.business_participants bp, public.profiles me
    WHERE c.id = public.call_todos.call_id AND bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true AND bp.congregation_id = c.congregation_id
  )
);

DROP POLICY IF EXISTS "Call todos: update" ON public.call_todos;
CREATE POLICY "Call todos: update" ON public.call_todos FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.calls c, public.business_participants bp, public.profiles me
    WHERE c.id = public.call_todos.call_id AND bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true AND bp.congregation_id = c.congregation_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.calls c, public.business_participants bp, public.profiles me
    WHERE c.id = public.call_todos.call_id AND bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true AND bp.congregation_id = c.congregation_id
  )
);

DROP POLICY IF EXISTS "Call todos: delete" ON public.call_todos;
CREATE POLICY "Call todos: delete" ON public.call_todos FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.calls c, public.business_participants bp, public.profiles me
    WHERE c.id = public.call_todos.call_id AND bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true AND bp.congregation_id = c.congregation_id
  )
);

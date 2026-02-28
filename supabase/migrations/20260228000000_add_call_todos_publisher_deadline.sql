-- Add publisher/partner and deadline to call_todos (like calls table)
-- Enables "New To-Do" standalone form and display of assignee/deadline per to-do
ALTER TABLE public.call_todos ADD COLUMN IF NOT EXISTS publisher_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.call_todos ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.call_todos ADD COLUMN IF NOT EXISTS deadline_date date;

CREATE INDEX IF NOT EXISTS call_todos_publisher_id_idx ON public.call_todos(publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS call_todos_deadline_date_idx ON public.call_todos(deadline_date) WHERE deadline_date IS NOT NULL;

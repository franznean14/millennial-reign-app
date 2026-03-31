-- Contact (householder) statuses: neutral, no longer active at this establishment / area.
ALTER TYPE public.householder_status_t ADD VALUE 'moved_branch';
ALTER TYPE public.householder_status_t ADD VALUE 'resigned';

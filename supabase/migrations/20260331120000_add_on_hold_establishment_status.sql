-- Establishment status: pause work temporarily (neutral). Stored in business_establishments.statuses text[];
-- Also extend enum where referenced for consistency with other establishment status values.
ALTER TYPE public.business_establishment_status_t ADD VALUE 'on_hold';

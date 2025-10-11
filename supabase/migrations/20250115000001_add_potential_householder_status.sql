-- Add 'potential' to the business_householder_status_t enum
-- This migration adds the new 'potential' status to the householder status enum

-- Add 'potential' to the existing enum
ALTER TYPE public.business_householder_status_t ADD VALUE 'potential';

-- Update any existing householders that might need the new status
-- (This is optional - you can manually update specific records if needed)
-- UPDATE public.business_householders SET status = 'potential' WHERE status = 'interested' AND note LIKE '%potential%';

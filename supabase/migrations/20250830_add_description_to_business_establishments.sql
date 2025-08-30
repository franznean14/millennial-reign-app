-- Add description field to business_establishments table
ALTER TABLE public.business_establishments 
ADD COLUMN IF NOT EXISTS description text;

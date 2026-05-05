-- Rename businesses table to businesses
ALTER TABLE public.businesses RENAME TO businesses;

-- Update foreign key references in other tables (PostgreSQL handles this automatically if renamed, but we should ensure naming consistency if needed)
-- Note: PostgreSQL automatically updates the table name in foreign key constraints.

-- Rename the unique index for custom domain if it exists
ALTER INDEX IF EXISTS businesses_custom_domain_key RENAME TO businesses_custom_domain_key;
ALTER INDEX IF EXISTS businesses_slug_key RENAME TO businesses_slug_key;
ALTER INDEX IF EXISTS businesses_pkey RENAME TO businesses_pkey;

-- Update any comments or descriptions if necessary
COMMENT ON TABLE public.businesses IS 'Table for F&B businesses (formerly businesses)';

-- Add business_type column to businesses table
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS business_type text DEFAULT 'cafe';
COMMENT ON COLUMN public.businesses.business_type IS 'Type of business (e.g., cafe, restaurant, bakery, bar)';

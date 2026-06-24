ALTER TABLE ekgx_leads
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS locations text;

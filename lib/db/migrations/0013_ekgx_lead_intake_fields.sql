ALTER TABLE ekgx_leads
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS intended_use text,
  ADD COLUMN IF NOT EXISTS purchase_timeline text,
  ADD COLUMN IF NOT EXISTS callback_preference text;

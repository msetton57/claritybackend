ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS password_reset_required boolean NOT NULL DEFAULT true;

UPDATE users
SET
  password_hash = COALESCE(password_hash, 'legacy:2468'),
  password_reset_required = COALESCE(password_reset_required, true)
WHERE password_hash IS NULL;

ALTER TABLE users
  ALTER COLUMN password_hash SET NOT NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS collections_status text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS last_payment_date text,
  ADD COLUMN IF NOT EXISTS promised_payment_date text,
  ADD COLUMN IF NOT EXISTS promise_note text,
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS write_off_reason text,
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamp;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fulfillment_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS last_action_at timestamp;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id serial PRIMARY KEY,
  invoice_id integer NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_date text NOT NULL,
  payment_method text,
  reference_number text,
  notes text,
  created_by text NOT NULL DEFAULT 'Clarity',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_activities (
  id serial PRIMARY KEY,
  invoice_id integer NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  title text NOT NULL,
  details text,
  previous_value text,
  next_value text,
  created_by text NOT NULL DEFAULT 'Clarity',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_activities (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  title text NOT NULL,
  details text,
  previous_value text,
  next_value text,
  created_by text NOT NULL DEFAULT 'Clarity',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_account_actions (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  title text NOT NULL,
  details text,
  previous_value text,
  next_value text,
  created_by text NOT NULL DEFAULT 'Clarity',
  created_at timestamp NOT NULL DEFAULT now()
);

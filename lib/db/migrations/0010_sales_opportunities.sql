CREATE TABLE IF NOT EXISTS sales_opportunities (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'New lead',
  source text NOT NULL DEFAULT 'existing_customer',
  lifecycle text NOT NULL DEFAULT 'open',
  due_date text,
  notes text,
  last_contacted_at timestamp,
  last_contact_note text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

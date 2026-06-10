CREATE TABLE IF NOT EXISTS shipping_policies (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  carrier text,
  shipping_method text NOT NULL,
  shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_policy_id integer REFERENCES shipping_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_carrier text;

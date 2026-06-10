CREATE TABLE IF NOT EXISTS customer_product_pricing (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  custom_unit_price numeric(10, 2) NOT NULL,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_product_pricing_customer_product_idx
  ON customer_product_pricing (customer_id, product_id);

ALTER TABLE products ADD COLUMN IF NOT EXISTS average_cost numeric(12,4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_purchase_cost numeric(12,4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS supply_requisitions (
  id serial PRIMARY KEY, requisition_number text NOT NULL UNIQUE, requested_by text NOT NULL,
  needed_by text, destination text NOT NULL DEFAULT 'Main Warehouse', status text NOT NULL DEFAULT 'draft',
  notes text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supply_requisition_lines (
  id serial PRIMARY KEY, requisition_id integer NOT NULL REFERENCES supply_requisitions(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id), quantity integer NOT NULL,
  estimated_unit_cost numeric(12,4) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS supply_purchase_orders (
  id serial PRIMARY KEY, po_number text NOT NULL UNIQUE, requisition_id integer REFERENCES supply_requisitions(id),
  vendor_id integer NOT NULL REFERENCES supply_vendors(id), status text NOT NULL DEFAULT 'draft',
  order_date text NOT NULL, expected_date text, destination text NOT NULL DEFAULT 'Main Warehouse',
  payment_terms text NOT NULL DEFAULT 'Net 30', notes text, approved_by text, approved_at timestamp,
  issued_at timestamp, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supply_purchase_order_lines (
  id serial PRIMARY KEY, purchase_order_id integer NOT NULL REFERENCES supply_purchase_orders(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id), ordered_quantity integer NOT NULL,
  unit_cost numeric(12,4) NOT NULL, received_quantity integer NOT NULL DEFAULT 0,
  damaged_quantity integer NOT NULL DEFAULT 0, rejected_quantity integer NOT NULL DEFAULT 0,
  UNIQUE (purchase_order_id, product_id)
);
CREATE TABLE IF NOT EXISTS supply_procurement_shipments (
  id serial PRIMARY KEY, shipment_number text NOT NULL UNIQUE,
  purchase_order_id integer NOT NULL REFERENCES supply_purchase_orders(id), status text NOT NULL DEFAULT 'planned',
  origin text NOT NULL, destination text NOT NULL, departure_date text, eta text, carrier text,
  tracking_number text, container_number text, freight_cost numeric(14,2) NOT NULL DEFAULT 0,
  customs_and_duties numeric(14,2) NOT NULL DEFAULT 0, brokerage_fees numeric(14,2) NOT NULL DEFAULT 0,
  drayage numeric(14,2) NOT NULL DEFAULT 0, warehouse_receiving_costs numeric(14,2) NOT NULL DEFAULT 0,
  miscellaneous_costs numeric(14,2) NOT NULL DEFAULT 0, notes text,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supply_shipment_lines (
  id serial PRIMARY KEY, shipment_id integer NOT NULL REFERENCES supply_procurement_shipments(id) ON DELETE CASCADE,
  purchase_order_line_id integer NOT NULL REFERENCES supply_purchase_order_lines(id), quantity integer NOT NULL,
  allocated_landed_cost numeric(14,4) NOT NULL DEFAULT 0, allocation_override boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS supply_receipts (
  id serial PRIMARY KEY, receipt_number text NOT NULL UNIQUE,
  shipment_id integer NOT NULL REFERENCES supply_procurement_shipments(id), status text NOT NULL DEFAULT 'draft',
  received_at timestamp NOT NULL DEFAULT now(), received_by text NOT NULL, discrepancy_notes text,
  confirmed_at timestamp, reversed_at timestamp, created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supply_receipt_lines (
  id serial PRIMARY KEY, receipt_id integer NOT NULL REFERENCES supply_receipts(id) ON DELETE CASCADE,
  shipment_line_id integer NOT NULL REFERENCES supply_shipment_lines(id), accepted_quantity integer NOT NULL DEFAULT 0,
  damaged_quantity integer NOT NULL DEFAULT 0, rejected_quantity integer NOT NULL DEFAULT 0,
  landed_unit_cost numeric(12,4) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS supply_vendor_bills (
  id serial PRIMARY KEY, bill_number text NOT NULL UNIQUE,
  purchase_order_id integer NOT NULL REFERENCES supply_purchase_orders(id), vendor_invoice_number text NOT NULL,
  invoice_date text NOT NULL, amount numeric(14,2) NOT NULL, status text NOT NULL DEFAULT 'unmatched',
  matched_at timestamp, created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supply_inventory_movements (
  id serial PRIMARY KEY, product_id integer NOT NULL REFERENCES products(id), movement_type text NOT NULL,
  quantity integer NOT NULL, unit_cost numeric(12,4) NOT NULL DEFAULT 0, reference_type text NOT NULL,
  reference_id integer NOT NULL, notes text, created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supply_approvals (
  id serial PRIMARY KEY, entity_type text NOT NULL, entity_id integer NOT NULL, action text NOT NULL,
  actor_name text NOT NULL, comments text, created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supply_documents (
  id serial PRIMARY KEY, entity_type text NOT NULL, entity_id integer NOT NULL, document_type text NOT NULL,
  file_name text NOT NULL, mime_type text NOT NULL, size_bytes integer NOT NULL, checksum text NOT NULL,
  content_base64 text NOT NULL, uploaded_by text NOT NULL, created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS supply_activity_events (
  id serial PRIMARY KEY, entity_type text NOT NULL, entity_id integer NOT NULL, event_type text NOT NULL,
  summary text NOT NULL, actor_name text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

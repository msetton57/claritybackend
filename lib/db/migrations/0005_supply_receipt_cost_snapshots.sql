ALTER TABLE supply_receipt_lines
  ADD COLUMN IF NOT EXISTS inventory_qty_before integer,
  ADD COLUMN IF NOT EXISTS average_cost_before numeric(12,4),
  ADD COLUMN IF NOT EXISTS last_purchase_cost_before numeric(12,4);

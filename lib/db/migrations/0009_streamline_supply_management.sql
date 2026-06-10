UPDATE supply_purchase_orders
SET status = 'draft', updated_at = now()
WHERE status IN ('pending_approval', 'approved');

UPDATE supply_procurement_shipments
SET status = CASE
  WHEN status IN ('planned', 'booked') THEN 'created'
  WHEN status = 'customs' THEN 'in_transit'
  ELSE status
END,
updated_at = now()
WHERE status IN ('planned', 'booked', 'customs');

ALTER TABLE supply_purchase_orders
  DROP COLUMN IF EXISTS requisition_id,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_at;

DROP TABLE IF EXISTS supply_requisition_lines;
DROP TABLE IF EXISTS supply_requisitions;
DROP TABLE IF EXISTS supply_approvals;

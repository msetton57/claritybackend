import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const supplyVendorsTable = pgTable("supply_vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  vendorCode: text("vendor_code").notNull().unique(),
  primaryContactName: text("primary_contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  leadTimeDays: integer("lead_time_days").notNull().default(0),
  onTimeDeliveryPct: numeric("on_time_delivery_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("0.00"),
  shipmentCount: integer("shipment_count").notNull().default(0),
  totalSpend: numeric("total_spend", { precision: 14, scale: 2 })
    .notNull()
    .default("0.00"),
  qualityRating: numeric("quality_rating", { precision: 3, scale: 1 })
    .notNull()
    .default("0.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplyShipmentsTable = pgTable("supply_shipments", {
  id: serial("id").primaryKey(),
  shipmentId: text("shipment_id").notNull().unique(),
  vendorId: integer("vendor_id")
    .notNull()
    .references(() => supplyVendorsTable.id),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  departureDate: text("departure_date").notNull(),
  eta: text("eta").notNull(),
  status: text("status").notNull(),
  trackingNumber: text("tracking_number").notNull(),
  purchaseOrderNumber: text("purchase_order_number").notNull(),
  containerNumber: text("container_number").notNull(),
  skuCount: integer("sku_count").notNull().default(0),
  quantity: integer("quantity").notNull().default(0),
  productCost: numeric("product_cost", { precision: 14, scale: 2 })
    .notNull()
    .default("0.00"),
  freightCost: numeric("freight_cost", { precision: 14, scale: 2 })
    .notNull()
    .default("0.00"),
  customsAndDuties: numeric("customs_and_duties", { precision: 14, scale: 2 })
    .notNull()
    .default("0.00"),
  brokerageFees: numeric("brokerage_fees", { precision: 14, scale: 2 })
    .notNull()
    .default("0.00"),
  drayage: numeric("drayage", { precision: 14, scale: 2 })
    .notNull()
    .default("0.00"),
  warehouseReceivingCosts: numeric("warehouse_receiving_costs", {
    precision: 14,
    scale: 2,
  })
    .notNull()
    .default("0.00"),
  miscellaneousCosts: numeric("miscellaneous_costs", {
    precision: 14,
    scale: 2,
  })
    .notNull()
    .default("0.00"),
  notes: text("notes"),
  documents: jsonb("documents")
    .$type<
      Array<{ name: string; status: "Uploaded" | "Missing" | "Pending" }>
    >()
    .notNull()
    .default(sql`'[]'::jsonb`),
  timeline: text("timeline")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplyInventoryCostingTable = pgTable("supply_inventory_costing", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  productName: text("product_name").notNull(),
  currentInventory: integer("current_inventory").notNull().default(0),
  currentAverageCost: numeric("current_average_cost", {
    precision: 12,
    scale: 2,
  })
    .notNull()
    .default("0.00"),
  lastPurchaseCost: numeric("last_purchase_cost", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  incomingLandedCost: numeric("incoming_landed_cost", {
    precision: 12,
    scale: 2,
  })
    .notNull()
    .default("0.00"),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplyPurchaseOrdersTable = pgTable("supply_purchase_orders", {
  id: serial("id").primaryKey(),
  poNumber: text("po_number").notNull().unique(),
  vendorId: integer("vendor_id")
    .notNull()
    .references(() => supplyVendorsTable.id),
  status: text("status").notNull().default("draft"),
  orderDate: text("order_date").notNull(),
  expectedDate: text("expected_date"),
  destination: text("destination").notNull().default("Main Warehouse"),
  paymentTerms: text("payment_terms").notNull().default("Net 30"),
  notes: text("notes"),
  issuedAt: timestamp("issued_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supplyPurchaseOrderLinesTable = pgTable(
  "supply_purchase_order_lines",
  {
    id: serial("id").primaryKey(),
    purchaseOrderId: integer("purchase_order_id")
      .notNull()
      .references(() => supplyPurchaseOrdersTable.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id),
    orderedQuantity: integer("ordered_quantity").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 4 }).notNull(),
    receivedQuantity: integer("received_quantity").notNull().default(0),
    damagedQuantity: integer("damaged_quantity").notNull().default(0),
    rejectedQuantity: integer("rejected_quantity").notNull().default(0),
  },
  (table) => [
    uniqueIndex("supply_po_line_product_unique").on(
      table.purchaseOrderId,
      table.productId,
    ),
  ],
);

export const supplyProcurementShipmentsTable = pgTable(
  "supply_procurement_shipments",
  {
    id: serial("id").primaryKey(),
    shipmentNumber: text("shipment_number").notNull().unique(),
    purchaseOrderId: integer("purchase_order_id")
      .notNull()
      .references(() => supplyPurchaseOrdersTable.id),
    status: text("status").notNull().default("planned"),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    departureDate: text("departure_date"),
    eta: text("eta"),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    containerNumber: text("container_number"),
    freightCost: numeric("freight_cost", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    customsAndDuties: numeric("customs_and_duties", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    brokerageFees: numeric("brokerage_fees", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    drayage: numeric("drayage", { precision: 14, scale: 2 })
      .notNull()
      .default("0.00"),
    warehouseReceivingCosts: numeric("warehouse_receiving_costs", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0.00"),
    miscellaneousCosts: numeric("miscellaneous_costs", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0.00"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

export const supplyShipmentLinesTable = pgTable("supply_shipment_lines", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id")
    .notNull()
    .references(() => supplyProcurementShipmentsTable.id, {
      onDelete: "cascade",
    }),
  purchaseOrderLineId: integer("purchase_order_line_id")
    .notNull()
    .references(() => supplyPurchaseOrderLinesTable.id),
  quantity: integer("quantity").notNull(),
  allocatedLandedCost: numeric("allocated_landed_cost", {
    precision: 14,
    scale: 4,
  })
    .notNull()
    .default("0.0000"),
  allocationOverride: boolean("allocation_override").notNull().default(false),
});

export const supplyReceiptsTable = pgTable("supply_receipts", {
  id: serial("id").primaryKey(),
  receiptNumber: text("receipt_number").notNull().unique(),
  shipmentId: integer("shipment_id")
    .notNull()
    .references(() => supplyProcurementShipmentsTable.id),
  status: text("status").notNull().default("draft"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  receivedBy: text("received_by").notNull(),
  discrepancyNotes: text("discrepancy_notes"),
  confirmedAt: timestamp("confirmed_at"),
  reversedAt: timestamp("reversed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplyReceiptLinesTable = pgTable("supply_receipt_lines", {
  id: serial("id").primaryKey(),
  receiptId: integer("receipt_id")
    .notNull()
    .references(() => supplyReceiptsTable.id, { onDelete: "cascade" }),
  shipmentLineId: integer("shipment_line_id")
    .notNull()
    .references(() => supplyShipmentLinesTable.id),
  acceptedQuantity: integer("accepted_quantity").notNull().default(0),
  damagedQuantity: integer("damaged_quantity").notNull().default(0),
  rejectedQuantity: integer("rejected_quantity").notNull().default(0),
  landedUnitCost: numeric("landed_unit_cost", { precision: 12, scale: 4 })
    .notNull()
    .default("0.0000"),
  inventoryQtyBefore: integer("inventory_qty_before"),
  averageCostBefore: numeric("average_cost_before", {
    precision: 12,
    scale: 4,
  }),
  lastPurchaseCostBefore: numeric("last_purchase_cost_before", {
    precision: 12,
    scale: 4,
  }),
});

export const supplyVendorBillsTable = pgTable("supply_vendor_bills", {
  id: serial("id").primaryKey(),
  billNumber: text("bill_number").notNull().unique(),
  purchaseOrderId: integer("purchase_order_id")
    .notNull()
    .references(() => supplyPurchaseOrdersTable.id),
  vendorInvoiceNumber: text("vendor_invoice_number").notNull(),
  invoiceDate: text("invoice_date").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  status: text("status").notNull().default("unmatched"),
  matchedAt: timestamp("matched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplyInventoryMovementsTable = pgTable(
  "supply_inventory_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id),
    movementType: text("movement_type").notNull(),
    quantity: integer("quantity").notNull(),
    unitCost: numeric("unit_cost", { precision: 12, scale: 4 })
      .notNull()
      .default("0.0000"),
    referenceType: text("reference_type").notNull(),
    referenceId: integer("reference_id").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

export const supplyDocumentsTable = pgTable("supply_documents", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum").notNull(),
  contentBase64: text("content_base64").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supplyActivityEventsTable = pgTable("supply_activity_events", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  eventType: text("event_type").notNull(),
  summary: text("summary").notNull(),
  actorName: text("actor_name"),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupplyVendorSchema = createInsertSchema(
  supplyVendorsTable,
).omit({ id: true, createdAt: true });
export const insertSupplyShipmentSchema = createInsertSchema(
  supplyShipmentsTable,
).omit({ id: true, createdAt: true });
export const insertSupplyInventoryCostingSchema = createInsertSchema(
  supplyInventoryCostingTable,
).omit({ id: true, createdAt: true });

export type InsertSupplyVendor = z.infer<typeof insertSupplyVendorSchema>;
export type InsertSupplyShipment = z.infer<typeof insertSupplyShipmentSchema>;
export type InsertSupplyInventoryCosting = z.infer<
  typeof insertSupplyInventoryCostingSchema
>;

export type SupplyVendor = typeof supplyVendorsTable.$inferSelect;
export type SupplyShipment = typeof supplyShipmentsTable.$inferSelect;
export type SupplyInventoryCosting =
  typeof supplyInventoryCostingTable.$inferSelect;

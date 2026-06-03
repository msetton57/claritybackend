import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { salesRepsTable } from "./sales_reps";
import { productsTable } from "./products";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  repId: integer("rep_id").references(() => salesRepsTable.id),
  status: text("status").notNull().default("open"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0.00"),
  discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).notNull().default("0.00"),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0.00"),
  shippingMethod: text("shipping_method"),
  trackingNumber: text("tracking_number"),
  customTerms: text("custom_terms"),
  orderDate: timestamp("order_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  promotionName: text("promotion_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true, createdAt: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItemsTable.$inferSelect;

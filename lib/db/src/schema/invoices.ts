import { pgTable, serial, text, numeric, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { ordersTable } from "./orders";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  orderId: integer("order_id").references(() => ordersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }).notNull().default("0.00"),
  dueDate: text("due_date").notNull(),
  invoiceDate: text("invoice_date").notNull(),
  isPaid: boolean("is_paid").notNull().default(false),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  collectionsStatus: text("collections_status").notNull().default("current"),
  lastPaymentDate: text("last_payment_date"),
  promisedPaymentDate: text("promised_payment_date"),
  promiseNote: text("promise_note"),
  disputeReason: text("dispute_reason"),
  writeOffReason: text("write_off_reason"),
  externalRef: text("external_ref"),
  syncStatus: text("sync_status").notNull().default("not_synced"),
  syncError: text("sync_error"),
  lastSyncedAt: timestamp("last_synced_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoicePaymentsTable = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: text("payment_date").notNull(),
  paymentMethod: text("payment_method"),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdBy: text("created_by").notNull().default("Clarity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoiceActivitiesTable = pgTable("invoice_activities", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  activityType: text("activity_type").notNull(),
  title: text("title").notNull(),
  details: text("details"),
  previousValue: text("previous_value"),
  nextValue: text("next_value"),
  createdBy: text("created_by").notNull().default("Clarity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
export type InvoicePayment = typeof invoicePaymentsTable.$inferSelect;
export type InvoiceActivity = typeof invoiceActivitiesTable.$inferSelect;

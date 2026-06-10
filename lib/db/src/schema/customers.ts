import { boolean, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesRepsTable } from "./sales_reps";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  companyName: text("company_name").notNull().default(""),
  primaryContactName: text("primary_contact_name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  billingAddress: text("billing_address"),
  shippingAddress: text("shipping_address"),
  status: text("status").notNull().default("active"),
  repId: integer("rep_id").references(() => salesRepsTable.id),
  creditLimit: numeric("credit_limit", { precision: 12, scale: 2 }).notNull().default("10000.00"),
  customPricing: boolean("custom_pricing").notNull().default(false),
  customTerms: text("custom_terms"),
  customerSinceDate: text("customer_since_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;

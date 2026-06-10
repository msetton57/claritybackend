import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shippingPoliciesTable = pgTable("shipping_policies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  carrier: text("carrier"),
  shippingMethod: text("shipping_method").notNull(),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertShippingPolicySchema = createInsertSchema(shippingPoliciesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShippingPolicy = z.infer<typeof insertShippingPolicySchema>;
export type ShippingPolicy = typeof shippingPoliciesTable.$inferSelect;

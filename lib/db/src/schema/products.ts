import { sql } from "drizzle-orm";
import { pgTable, serial, text, numeric, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull().default("General"),
  description: text("description"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  inventoryQty: integer("inventory_qty").notNull().default(0),
  averageCost: numeric("average_cost", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  lastPurchaseCost: numeric("last_purchase_cost", { precision: 12, scale: 4 }).notNull().default("0.0000"),
  etaDate: text("eta_date"),
  imageUrl: text("image_url"),
  packSize: text("pack_size"),
  certifications: text("certifications").array().notNull().default(sql`'{}'::text[]`),
  brochureUrl: text("brochure_url"),
  infoSheetUrl: text("info_sheet_url"),
  archived: boolean("archived").notNull().default(false),
  archiveReason: text("archive_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

import { integer, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { productsTable } from "./products";

export const customerProductPricingTable = pgTable(
  "customer_product_pricing",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
    productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    customUnitPrice: numeric("custom_unit_price", { precision: 10, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    customerProductUniqueIdx: uniqueIndex("customer_product_pricing_customer_product_idx").on(table.customerId, table.productId),
  }),
);

import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const salesOpportunitiesTable = pgTable("sales_opportunities", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("New lead"),
  source: text("source").notNull().default("existing_customer"),
  lifecycle: text("lifecycle").notNull().default("open"),
  dueDate: text("due_date"),
  notes: text("notes"),
  lastContactedAt: timestamp("last_contacted_at"),
  lastContactNote: text("last_contact_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SalesOpportunity = typeof salesOpportunitiesTable.$inferSelect;

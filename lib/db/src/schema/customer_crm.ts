import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const customerContactsTable = pgTable("customer_contacts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customerActivitiesTable = pgTable("customer_activities", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  activityType: text("activity_type").notNull(),
  subject: text("subject").notNull(),
  details: text("details"),
  outcome: text("outcome"),
  dueDate: text("due_date"),
  isCompleted: boolean("is_completed").notNull().default(false),
  createdBy: text("created_by").notNull().default("Sales Team"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customerAccountActionsTable = pgTable("customer_account_actions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  title: text("title").notNull(),
  details: text("details"),
  previousValue: text("previous_value"),
  nextValue: text("next_value"),
  createdBy: text("created_by").notNull().default("Clarity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerContactSchema = createInsertSchema(customerContactsTable).omit({ id: true, createdAt: true });
export const insertCustomerActivitySchema = createInsertSchema(customerActivitiesTable).omit({ id: true, createdAt: true });

export type InsertCustomerContact = z.infer<typeof insertCustomerContactSchema>;
export type InsertCustomerActivity = z.infer<typeof insertCustomerActivitySchema>;

export type CustomerContact = typeof customerContactsTable.$inferSelect;
export type CustomerActivity = typeof customerActivitiesTable.$inferSelect;
export type CustomerAccountAction = typeof customerAccountActionsTable.$inferSelect;

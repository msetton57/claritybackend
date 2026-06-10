import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { usersTable } from "./users";

export const customerFlagsTable = pgTable(
  "customer_flags",
  {
    customerId: integer("customer_id")
      .notNull()
      .references(() => customersTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.customerId, table.userId] })],
);

export const ekgxLeadsTable = pgTable(
  "ekgx_leads",
  {
    id: serial("id").primaryKey(),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    submittedAt: timestamp("submitted_at").notNull(),
    status: text("status").notNull().default("not_contacted"),
    source: text("source").notNull().default("Facebook"),
    notes: text("notes").notNull().default(""),
    lastContactAt: timestamp("last_contact_at"),
    lastContactSummary: text("last_contact_summary"),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("ekgx_leads_identity_unique").on(table.businessName, table.contactName, table.submittedAt)],
);

export const workspaceActionPointsTable = pgTable("workspace_action_points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  details: text("details").notNull().default(""),
  dueDate: text("due_date"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

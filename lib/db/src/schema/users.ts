import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { salesRepsTable } from "./sales_reps";

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    salesRepId: integer("sales_rep_id").references(() => salesRepsTable.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    passwordResetRequired: boolean("password_reset_required").notNull().default(true),
    title: text("title").notNull().default("Sales Representative"),
    role: text("role").notNull().default("sales_rep"),
    status: text("status").notNull().default("active"),
    lastActiveAt: timestamp("last_active_at"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_sales_rep_id_unique").on(table.salesRepId),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

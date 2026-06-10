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
import { usersTable } from "./users";

export const authSessionsTable = pgTable(
  "auth_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash)],
);

export const collaborativeTasksTable = pgTable("collaborative_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes"),
  priority: text("priority").notNull().default("medium"),
  category: text("category").notNull().default("Follow-up"),
  completed: boolean("completed").notNull().default(false),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  completedByUserId: integer("completed_by_user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const taskAssignmentsTable = pgTable(
  "task_assignments",
  {
    taskId: integer("task_id")
      .notNull()
      .references(() => collaborativeTasksTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    assignmentSource: text("assignment_source").notNull().default("mention"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.userId] })],
);

export const posterPostsTable = pgTable("poster_posts", {
  id: serial("id").primaryKey(),
  postType: text("post_type").notNull().default("announcement"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  includeAllUsers: boolean("include_all_users").notNull().default(false),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posterPostTargetsTable = pgTable(
  "poster_post_targets",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posterPostsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })],
);

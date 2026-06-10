import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const workspaceFoldersTable = pgTable("workspace_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workspaceDocumentsTable = pgTable("workspace_documents", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id"),
  title: text("title").notNull(),
  category: text("category").notNull().default("General"),
  description: text("description"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum").notNull(),
  contentBase64: text("content_base64").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type WorkspaceFolder = typeof workspaceFoldersTable.$inferSelect;
export type WorkspaceDocument = typeof workspaceDocumentsTable.$inferSelect;

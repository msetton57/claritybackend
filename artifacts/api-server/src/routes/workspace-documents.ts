import { createHash } from "node:crypto";
import path from "node:path";
import { Router } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, workspaceDocumentsTable, workspaceFoldersTable } from "@workspace/db";

const router = Router();

const uploadSchema = z.object({
  folderId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).nullish().transform((value) => value || null),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().optional(),
  contentBase64: z.string().trim().min(1),
  uploadedBy: z.string().trim().min(1).max(120),
});

const folderSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentId: z.number().int().positive().nullable().optional(),
  createdBy: z.string().trim().min(1).max(120),
});

const updateFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const moveDocumentSchema = z.object({
  folderId: z.number().int().positive().nullable(),
});

function inferMimeType(fileName: string, rawMimeType?: string) {
  if (rawMimeType && rawMimeType !== "application/octet-stream") {
    return rawMimeType;
  }

  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".csv":
      return "text/csv";
    case ".txt":
      return "text/plain";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".xls":
      return "application/vnd.ms-excel";
    case ".xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}

function isPreviewable(mimeType: string) {
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json"
  );
}

router.get("/workspace", async (_req, res): Promise<void> => {
  const [folders, documents] = await Promise.all([
    db
      .select({
        id: workspaceFoldersTable.id,
        name: workspaceFoldersTable.name,
        parentId: workspaceFoldersTable.parentId,
        createdBy: workspaceFoldersTable.createdBy,
        createdAt: workspaceFoldersTable.createdAt,
      })
      .from(workspaceFoldersTable)
      .orderBy(asc(workspaceFoldersTable.name)),
    db
      .select({
        id: workspaceDocumentsTable.id,
        folderId: workspaceDocumentsTable.folderId,
        title: workspaceDocumentsTable.title,
        category: workspaceDocumentsTable.category,
        description: workspaceDocumentsTable.description,
        fileName: workspaceDocumentsTable.fileName,
        mimeType: workspaceDocumentsTable.mimeType,
        sizeBytes: workspaceDocumentsTable.sizeBytes,
        uploadedBy: workspaceDocumentsTable.uploadedBy,
        createdAt: workspaceDocumentsTable.createdAt,
      })
      .from(workspaceDocumentsTable)
      .orderBy(desc(workspaceDocumentsTable.createdAt)),
  ]);

  res.json({ folders, documents });
});

router.post("/workspace/folders", async (req, res): Promise<void> => {
  const parsed = folderSchema.safeParse(req.body);

  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid folder payload" });
  }

  const [folder] = await db
    .insert(workspaceFoldersTable)
    .values({
      name: parsed.data.name,
      parentId: parsed.data.parentId ?? null,
      createdBy: parsed.data.createdBy,
    })
    .returning({
      id: workspaceFoldersTable.id,
      name: workspaceFoldersTable.name,
      parentId: workspaceFoldersTable.parentId,
      createdBy: workspaceFoldersTable.createdBy,
      createdAt: workspaceFoldersTable.createdAt,
    });

  res.status(201).json(folder);
});

router.patch("/workspace/folders/:id", async (req, res): Promise<void> => {
  const folderId = Number(req.params.id);

  if (!Number.isFinite(folderId)) {
    return void res.status(400).json({ error: "Invalid folder id" });
  }

  const parsed = updateFolderSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid folder update payload" });
  }

  const [folder] = await db
    .update(workspaceFoldersTable)
    .set({ name: parsed.data.name })
    .where(eq(workspaceFoldersTable.id, folderId))
    .returning({
      id: workspaceFoldersTable.id,
      name: workspaceFoldersTable.name,
      parentId: workspaceFoldersTable.parentId,
      createdBy: workspaceFoldersTable.createdBy,
      createdAt: workspaceFoldersTable.createdAt,
    });

  if (!folder) {
    return void res.status(404).json({ error: "Folder not found" });
  }

  res.json(folder);
});

router.delete("/workspace/folders/:id", async (req, res): Promise<void> => {
  const folderId = Number(req.params.id);

  if (!Number.isFinite(folderId)) {
    return void res.status(400).json({ error: "Invalid folder id" });
  }

  const deleted = await db.transaction(async (tx) => {
    const [folder] = await tx
      .select({
        id: workspaceFoldersTable.id,
        parentId: workspaceFoldersTable.parentId,
      })
      .from(workspaceFoldersTable)
      .where(eq(workspaceFoldersTable.id, folderId));

    if (!folder) {
      return null;
    }

    await tx
      .update(workspaceFoldersTable)
      .set({ parentId: folder.parentId })
      .where(eq(workspaceFoldersTable.parentId, folderId));

    await tx
      .update(workspaceDocumentsTable)
      .set({ folderId: folder.parentId })
      .where(eq(workspaceDocumentsTable.folderId, folderId));

    const [removed] = await tx
      .delete(workspaceFoldersTable)
      .where(eq(workspaceFoldersTable.id, folderId))
      .returning({ id: workspaceFoldersTable.id });

    return removed ?? null;
  });

  if (!deleted) {
    return void res.status(404).json({ error: "Folder not found" });
  }

  res.status(204).send();
});

router.post("/workspace/documents", async (req, res): Promise<void> => {
  const parsed = uploadSchema.safeParse(req.body);

  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid upload payload" });
  }

  const mimeType = inferMimeType(parsed.data.fileName, parsed.data.mimeType);
  const buffer = Buffer.from(parsed.data.contentBase64, "base64");

  if (buffer.byteLength === 0) {
    return void res.status(400).json({ error: "Uploaded file is empty" });
  }

  if (buffer.byteLength > 15 * 1024 * 1024) {
    return void res.status(413).json({ error: "Files must be 15 MB or smaller" });
  }

  const checksum = createHash("sha256").update(buffer).digest("hex");

  const [document] = await db
    .insert(workspaceDocumentsTable)
    .values({
      folderId: parsed.data.folderId ?? null,
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description,
      fileName: parsed.data.fileName,
      mimeType,
      sizeBytes: buffer.byteLength,
      checksum,
      contentBase64: parsed.data.contentBase64,
      uploadedBy: parsed.data.uploadedBy,
    })
    .returning({
      id: workspaceDocumentsTable.id,
      folderId: workspaceDocumentsTable.folderId,
      title: workspaceDocumentsTable.title,
      fileName: workspaceDocumentsTable.fileName,
    });

  res.status(201).json(document);
});

router.get("/workspace/documents/:id", async (req, res): Promise<void> => {
  const documentId = Number(req.params.id);

  if (!Number.isFinite(documentId)) {
    return void res.status(400).json({ error: "Invalid document id" });
  }

  const [document] = await db
    .select()
    .from(workspaceDocumentsTable)
    .where(eq(workspaceDocumentsTable.id, documentId));

  if (!document) {
    return void res.status(404).json({ error: "Document not found" });
  }

  res.json({
    id: document.id,
    folderId: document.folderId,
    title: document.title,
    category: document.category,
    description: document.description,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    uploadedBy: document.uploadedBy,
    createdAt: document.createdAt,
    previewable: isPreviewable(document.mimeType),
    contentBase64: isPreviewable(document.mimeType) ? document.contentBase64 : null,
  });
});

router.get("/workspace/documents/:id/download", async (req, res): Promise<void> => {
  const documentId = Number(req.params.id);

  if (!Number.isFinite(documentId)) {
    return void res.status(400).json({ error: "Invalid document id" });
  }

  const [document] = await db
    .select()
    .from(workspaceDocumentsTable)
    .where(eq(workspaceDocumentsTable.id, documentId));

  if (!document) {
    return void res.status(404).json({ error: "Document not found" });
  }

  res.type(document.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${document.fileName.replaceAll('"', "")}"`);
  res.send(Buffer.from(document.contentBase64, "base64"));
});

router.patch("/workspace/documents/:id", async (req, res): Promise<void> => {
  const documentId = Number(req.params.id);

  if (!Number.isFinite(documentId)) {
    return void res.status(400).json({ error: "Invalid document id" });
  }

  const parsed = moveDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid document update payload" });
  }

  const [document] = await db
    .update(workspaceDocumentsTable)
    .set({ folderId: parsed.data.folderId })
    .where(eq(workspaceDocumentsTable.id, documentId))
    .returning({
      id: workspaceDocumentsTable.id,
      folderId: workspaceDocumentsTable.folderId,
      title: workspaceDocumentsTable.title,
    });

  if (!document) {
    return void res.status(404).json({ error: "Document not found" });
  }

  res.json(document);
});

router.delete("/workspace/documents/:id", async (req, res): Promise<void> => {
  const documentId = Number(req.params.id);

  if (!Number.isFinite(documentId)) {
    return void res.status(400).json({ error: "Invalid document id" });
  }

  const [deleted] = await db
    .delete(workspaceDocumentsTable)
    .where(eq(workspaceDocumentsTable.id, documentId))
    .returning({ id: workspaceDocumentsTable.id });

  if (!deleted) {
    return void res.status(404).json({ error: "Document not found" });
  }

  res.status(204).send();
});

export default router;

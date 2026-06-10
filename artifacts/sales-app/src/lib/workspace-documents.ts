import { fetchJson } from "./http";

export interface WorkspaceFolder {
  id: number;
  name: string;
  parentId: number | null;
  createdBy: string;
  createdAt: string;
}

export interface WorkspaceDocument {
  id: number;
  folderId: number | null;
  title: string;
  category: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export interface WorkspaceStore {
  folders: WorkspaceFolder[];
  documents: WorkspaceDocument[];
}

export interface WorkspaceDocumentDetail extends WorkspaceDocument {
  previewable: boolean;
  contentBase64: string | null;
}

interface UploadWorkspaceDocumentPayload {
  folderId?: number | null;
  title: string;
  category: string;
  description: string | null;
  fileName: string;
  mimeType?: string;
  contentBase64: string;
  uploadedBy: string;
}

interface CreateWorkspaceFolderPayload {
  name: string;
  parentId?: number | null;
  createdBy: string;
}

interface UpdateWorkspaceFolderPayload {
  name: string;
}

export function getWorkspaceStore() {
  return fetchJson<WorkspaceStore>("/api/workspace");
}

export function uploadWorkspaceDocument(payload: UploadWorkspaceDocumentPayload) {
  return fetchJson<{ id: number; folderId: number | null; title: string; fileName: string }>("/api/workspace/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createWorkspaceFolder(payload: CreateWorkspaceFolderPayload) {
  return fetchJson<WorkspaceFolder>("/api/workspace/folders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function renameWorkspaceFolder(folderId: number, payload: UpdateWorkspaceFolderPayload) {
  return fetchJson<WorkspaceFolder>(`/api/workspace/folders/${folderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteWorkspaceFolder(folderId: number) {
  return fetchJson<null>(`/api/workspace/folders/${folderId}`, {
    method: "DELETE",
  });
}

export function getWorkspaceDocument(documentId: number) {
  return fetchJson<WorkspaceDocumentDetail>(`/api/workspace/documents/${documentId}`);
}

export function moveWorkspaceDocument(documentId: number, folderId: number | null) {
  return fetchJson<{ id: number; folderId: number | null; title: string }>(`/api/workspace/documents/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify({ folderId }),
  });
}

export function deleteWorkspaceDocument(documentId: number) {
  return fetchJson<null>(`/api/workspace/documents/${documentId}`, {
    method: "DELETE",
  });
}

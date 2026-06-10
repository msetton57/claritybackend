import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Grid2X2,
  LayoutList,
  MoreHorizontal,
  Trash2,
  Plus,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { useCurrentUser } from "@/lib/users";
import {
  createWorkspaceFolder,
  deleteWorkspaceFolder,
  deleteWorkspaceDocument,
  getWorkspaceDocument,
  getWorkspaceStore,
  moveWorkspaceDocument,
  renameWorkspaceFolder,
  type WorkspaceDocument,
  type WorkspaceFolder,
  uploadWorkspaceDocument,
} from "@/lib/workspace-documents";

const categoryOptions = ["General", "Contracts", "Finance", "Sales", "HR", "Operations"];

type ViewMode = "grid" | "list";
type DeleteTarget =
  | { kind: "document"; item: WorkspaceDocument }
  | { kind: "folder"; item: WorkspaceFolder }
  | null;

async function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function uploadFileToWorkspace({
  file,
  folderId,
  title,
  category = categoryOptions[0],
  description = null,
  uploadedBy,
}: {
  file: File;
  folderId: number | null;
  title?: string;
  category?: string;
  description?: string | null;
  uploadedBy: string;
}) {
  const contentBase64 = await readFileAsBase64(file);

  return uploadWorkspaceDocument({
    folderId,
    title: title?.trim() || file.name.replace(/\.[^.]+$/, "") || file.name,
    category,
    description,
    fileName: file.name,
    mimeType: file.type || undefined,
    contentBase64,
    uploadedBy,
  });
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

function getDocumentIcon(document: WorkspaceDocument) {
  if (document.mimeType.startsWith("image/")) return FileImage;
  if (document.mimeType.includes("sheet") || document.mimeType.includes("excel") || document.mimeType === "text/csv") return FileSpreadsheet;
  return FileText;
}

function getFolderPath(folderId: number | null, folders: WorkspaceFolder[]) {
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const path: WorkspaceFolder[] = [];
  let currentId = folderId;

  while (currentId) {
    const folder = folderMap.get(currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parentId;
  }

  return path;
}

function FolderTree({
  folders,
  activeFolderId,
  onSelect,
  onDropDocument,
  dragTargetFolderId,
  setDragTargetFolderId,
}: {
  folders: WorkspaceFolder[];
  activeFolderId: number | null;
  onSelect: (folderId: number | null) => void;
  onDropDocument: (documentId: number, folderId: number | null) => void;
  dragTargetFolderId: number | null | undefined;
  setDragTargetFolderId: (folderId: number | null | undefined) => void;
}) {
  const grouped = new Map<number | null, WorkspaceFolder[]>();
  for (const folder of folders) {
    const list = grouped.get(folder.parentId) ?? [];
    list.push(folder);
    grouped.set(folder.parentId, list);
  }

  function renderBranch(parentId: number | null, depth = 0): React.ReactNode {
    const children = (grouped.get(parentId) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    return children.map((folder) => (
      <div key={folder.id}>
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={() => setDragTargetFolderId(folder.id)}
          onDragLeave={() => setDragTargetFolderId(undefined)}
          onDrop={(event) => {
            event.preventDefault();
            setDragTargetFolderId(undefined);
            const documentId = Number(event.dataTransfer.getData("text/workspace-document-id"));
            if (Number.isFinite(documentId)) {
              onDropDocument(documentId, folder.id);
            }
          }}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
            activeFolderId === folder.id
              ? "bg-slate-900 text-white"
              : dragTargetFolderId === folder.id
                ? "bg-slate-100 ring-2 ring-slate-300"
                : "text-slate-700 hover:bg-slate-100"
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <Folder className="size-4 shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
        {renderBranch(folder.id, depth + 1)}
      </div>
    ));
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onSelect(null)}
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={() => setDragTargetFolderId(null)}
        onDragLeave={() => setDragTargetFolderId(undefined)}
        onDrop={(event) => {
          event.preventDefault();
          setDragTargetFolderId(undefined);
          const documentId = Number(event.dataTransfer.getData("text/workspace-document-id"));
          if (Number.isFinite(documentId)) {
            onDropDocument(documentId, null);
          }
        }}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
          activeFolderId === null
            ? "bg-slate-900 text-white"
            : dragTargetFolderId === null
              ? "bg-slate-100 ring-2 ring-slate-300"
              : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        <FolderOpen className="size-4 shrink-0" />
        <span className="truncate">Shared drive</span>
      </button>
      {renderBranch(null)}
    </div>
  );
}

function CreateFolderDialog({
  open,
  onOpenChange,
  parentId,
  onCreated,
  createdBy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: number | null;
  onCreated: () => Promise<unknown>;
  createdBy: string;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createWorkspaceFolder({
        name: name.trim(),
        parentId,
        createdBy,
      }),
    onSuccess: async () => {
      await onCreated();
      setName("");
      onOpenChange(false);
      toast({ title: "Folder created" });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to create folder", description: error.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create folder</DialogTitle>
          <DialogDescription>Add a new folder to organize the shared drive.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="folder-name">Folder name</Label>
          <Input id="folder-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Pricing decks" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating..." : "Create folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  folders,
  defaultFolderId,
  onUploaded,
  uploadedBy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: WorkspaceFolder[];
  defaultFolderId: number | null;
  onUploaded: () => Promise<unknown>;
  uploadedBy: string;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categoryOptions[0]);
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string>(defaultFolderId ? String(defaultFolderId) : "root");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  React.useEffect(() => {
    setFolderId(defaultFolderId ? String(defaultFolderId) : "root");
  }, [defaultFolderId, open]);

  async function submit() {
    if (!file || !title.trim()) {
      toast({ title: "Add a title and file first", variant: "destructive" });
      return;
    }

    setIsUploading(true);

    try {
      await uploadFileToWorkspace({
        file,
        folderId: folderId === "root" ? null : Number(folderId),
        title: title.trim(),
        category,
        description: description.trim() || null,
        uploadedBy,
      });

      await onUploaded();
      setTitle("");
      setCategory(categoryOptions[0]);
      setDescription("");
      setFile(null);
      onOpenChange(false);
      toast({ title: "File uploaded", description: "The shared drive updated for everyone." });
    } catch (error) {
      toast({
        title: "Unable to upload file",
        description: error instanceof Error ? error.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload to shared drive</DialogTitle>
          <DialogDescription>Choose a folder, upload a file, and make it instantly available to the team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workspace-title">Title</Label>
              <Input id="workspace-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Board packet" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-category">Category</Label>
              <select
                id="workspace-category"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-folder">Folder</Label>
            <select
              id="workspace-folder"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
            >
              <option value="root">Shared drive root</option>
              {folders.map((folder) => {
                const path = getFolderPath(folder.id, folders).map((item) => item.name).join(" / ");
                return (
                  <option key={folder.id} value={String(folder.id)}>
                    {path}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-description">Description</Label>
            <Textarea id="workspace-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional notes for the team" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspace-file">File</Label>
            <Input id="workspace-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.doc,.docx,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">Preview works for images, PDFs, CSVs, and text files. Max file size: 15 MB.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!file || !title.trim() || isUploading} onClick={submit}>
            <Upload className="mr-2 size-4" />
            {isUploading ? "Uploading..." : "Upload file"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameFolderDialog({
  folder,
  open,
  onOpenChange,
  onRenamed,
}: {
  folder: WorkspaceFolder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");

  useEffect(() => {
    setName(folder?.name ?? "");
  }, [folder, open]);

  const mutation = useMutation({
    mutationFn: () => renameWorkspaceFolder(folder!.id, { name: name.trim() }),
    onSuccess: async () => {
      await onRenamed();
      onOpenChange(false);
      toast({ title: "Folder renamed" });
    },
    onError: (error: Error) =>
      toast({ title: "Unable to rename folder", description: error.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename folder</DialogTitle>
          <DialogDescription>Update the folder name without moving its contents.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rename-folder-name">Folder name</Label>
          <Input id="rename-folder-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Pricing decks" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!folder || !name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewDialog({
  documentId,
  onOpenChange,
}: {
  documentId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["workspace-document", documentId],
    queryFn: () => getWorkspaceDocument(documentId!),
    enabled: documentId !== null,
  });

  const detail = detailQuery.data;

  function renderPreview() {
    if (!detail) return null;
    if (!detail.previewable || !detail.contentBase64) {
      return <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Preview is not available for this file type.</div>;
    }

    const dataUrl = `data:${detail.mimeType};base64,${detail.contentBase64}`;

    if (detail.mimeType.startsWith("image/")) {
      return <img src={dataUrl} alt={detail.title} className="max-h-[60vh] w-full rounded-xl object-contain" />;
    }

    if (detail.mimeType === "application/pdf") {
      return <iframe src={dataUrl} title={detail.title} className="h-[60vh] w-full rounded-xl border" />;
    }

    const text = atob(detail.contentBase64);
    return <pre className="max-h-[60vh] overflow-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">{text}</pre>;
  }

  return (
    <Dialog open={documentId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{detail?.title ?? "Preview file"}</DialogTitle>
          <DialogDescription>{detail ? `${detail.fileName} · Uploaded ${formatDate(detail.createdAt)} by ${detail.uploadedBy}` : "Loading preview..."}</DialogDescription>
        </DialogHeader>
        {detailQuery.isLoading ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Loading preview...</div>
        ) : detailQuery.isError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{(detailQuery.error as Error)?.message ?? "Unable to load preview."}</div>
        ) : (
          renderPreview()
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SharedWorkspace() {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const actorName = currentUser?.name ?? "Clarity User";
  const [search, setSearch] = useState("");
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [renameFolderOpen, setRenameFolderOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<WorkspaceFolder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [previewDocumentId, setPreviewDocumentId] = useState<number | null>(null);
  const [dragTargetFolderId, setDragTargetFolderId] = useState<number | null | undefined>(undefined);
  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const { toast } = useToast();

  const workspaceQuery = useQuery({
    queryKey: ["workspace-drive"],
    queryFn: getWorkspaceStore,
  });

  const folders = workspaceQuery.data?.folders ?? [];
  const documents = workspaceQuery.data?.documents ?? [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextSearch = params.get("search");
    const nextFolderId = params.get("folderId");
    const nextPreviewId = params.get("preview");

    setSearch(nextSearch ?? "");
    setActiveFolderId(nextFolderId ? Number(nextFolderId) : null);
    setPreviewDocumentId(nextPreviewId ? Number(nextPreviewId) : null);
  }, [location]);

  const childFolders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return folders.filter((folder) => {
      const inLocation = folder.parentId === activeFolderId;
      const matchesSearch = !term || folder.name.toLowerCase().includes(term);
      return inLocation && matchesSearch;
    });
  }, [activeFolderId, folders, search]);

  const visibleDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((document) => {
      const inFolder = activeFolderId === null ? document.folderId === null : document.folderId === activeFolderId;
      const matchesSearch = !term || [document.title, document.fileName, document.category, document.description ?? "", document.uploadedBy].join(" ").toLowerCase().includes(term);
      return inFolder && matchesSearch;
    });
  }, [activeFolderId, documents, search]);

  const currentPath = getFolderPath(activeFolderId, folders);
  const refresh = async () => queryClient.invalidateQueries({ queryKey: ["workspace-drive"] });

  const moveMutation = useMutation({
    mutationFn: ({ documentId, folderId }: { documentId: number; folderId: number | null }) =>
      moveWorkspaceDocument(documentId, folderId),
    onSuccess: async (_, variables) => {
      await refresh();
      setDragTargetFolderId(undefined);
      const folderName =
        variables.folderId === null ? "Shared drive root" : folders.find((folder) => folder.id === variables.folderId)?.name ?? "folder";
      toast({ title: "File moved", description: `Moved into ${folderName}.` });
    },
    onError: (error: Error) => {
      setDragTargetFolderId(undefined);
      toast({ title: "Unable to move file", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: number) => deleteWorkspaceDocument(documentId),
    onSuccess: async () => {
      await refresh();
      setDeleteTarget(null);
      toast({ title: "File deleted" });
    },
    onError: (error: Error) => toast({ title: "Unable to delete file", description: error.message, variant: "destructive" }),
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: number) => deleteWorkspaceFolder(folderId),
    onSuccess: async (_, folderId) => {
      const folder = folders.find((item) => item.id === folderId);
      await refresh();
      if (activeFolderId === folderId) {
        setActiveFolderId(folder?.parentId ?? null);
      }
      setDeleteTarget(null);
      toast({
        title: "Folder deleted",
        description: "Its files and subfolders were moved up one level.",
      });
    },
    onError: (error: Error) => toast({ title: "Unable to delete folder", description: error.message, variant: "destructive" }),
  });

  const dropUploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setPendingUploadCount(files.length);
      for (const file of files) {
        await uploadFileToWorkspace({
          file,
          folderId: activeFolderId,
          uploadedBy: actorName,
        });
      }
    },
    onSuccess: async (_, files) => {
      await refresh();
      const locationName = currentPath.at(-1)?.name ?? "Shared drive";
      toast({
        title: files.length === 1 ? "File uploaded" : "Files uploaded",
        description: `${files.length} ${files.length === 1 ? "file was" : "files were"} added to ${locationName}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to upload dropped files",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setPendingUploadCount(0);
      setIsFileDragActive(false);
    },
  });

  function hasExternalFiles(event: React.DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function openDownload(documentId: number) {
    window.open(`/api/workspace/documents/${documentId}/download`, "_blank");
  }

  function beginDrag(event: React.DragEvent<HTMLElement>, documentId: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/workspace-document-id", String(documentId));
  }

  function handleWorkspaceDragEnter(event: React.DragEvent<HTMLElement>) {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    setIsFileDragActive(true);
  }

  function handleWorkspaceDragOver(event: React.DragEvent<HTMLElement>) {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!isFileDragActive) {
      setIsFileDragActive(true);
    }
  }

  function handleWorkspaceDragLeave(event: React.DragEvent<HTMLElement>) {
    if (!hasExternalFiles(event)) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsFileDragActive(false);
  }

  function handleWorkspaceDrop(event: React.DragEvent<HTMLElement>) {
    if (!hasExternalFiles(event)) return;
    event.preventDefault();
    setIsFileDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []).filter((file) => file.size > 0);
    if (files.length === 0) {
      return;
    }
    dropUploadMutation.mutate(files);
  }

  function moveDocumentToFolder(documentId: number, folderId: number | null) {
    const document = documents.find((item) => item.id === documentId);
    if (!document || document.folderId === folderId) {
      setDragTargetFolderId(undefined);
      return;
    }
    moveMutation.mutate({ documentId, folderId });
  }

  function openRenameFolder(folder: WorkspaceFolder) {
    setFolderToEdit(folder);
    setRenameFolderOpen(true);
  }

  function confirmDeleteTarget() {
    if (!deleteTarget) return;

    if (deleteTarget.kind === "document") {
      deleteMutation.mutate(deleteTarget.item.id);
      return;
    }

    deleteFolderMutation.mutate(deleteTarget.item.id);
  }

  function FolderActions({ folder }: { folder: WorkspaceFolder }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              openRenameFolder(folder);
            }}
          >
            Rename folder
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-rose-600 focus:text-rose-600"
            onClick={(event) => {
              event.stopPropagation();
              setDeleteTarget({ kind: "folder", item: folder });
            }}
          >
            Delete folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function DocumentGridCard({ document }: { document: WorkspaceDocument }) {
    const Icon = getDocumentIcon(document);
    return (
      <div
        draggable
        onDragStart={(event) => beginDrag(event, document.id)}
        onDragEnd={() => setDragTargetFolderId(undefined)}
        className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Icon className="size-5" />
          </div>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{document.category}</Badge>
        </div>
        <div className="mt-4">
          <div className="line-clamp-1 font-medium text-slate-950">{document.title}</div>
          <div className="mt-1 line-clamp-1 text-sm text-muted-foreground">{document.fileName}</div>
          <div className="mt-3 text-xs text-muted-foreground">
            {formatFileSize(document.sizeBytes)} · {document.uploadedBy}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPreviewDocumentId(document.id)}>
            <Eye className="mr-2 size-4" />
            Preview
          </Button>
          <Button size="sm" variant="outline" onClick={() => openDownload(document.id)}>
            <Download className="mr-2 size-4" />
            Download
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDeleteTarget({ kind: "document", item: document })}>
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout fluid>
      <div
        className="relative space-y-6"
        onDragEnter={handleWorkspaceDragEnter}
        onDragOver={handleWorkspaceDragOver}
        onDragLeave={handleWorkspaceDragLeave}
        onDrop={handleWorkspaceDrop}
      >
        {isFileDragActive ? (
          <div className="pointer-events-none absolute inset-0 z-20 rounded-[28px] border-2 border-dashed border-sky-400 bg-sky-50/90">
            <div className="flex h-full items-center justify-center p-6">
              <div className="rounded-2xl bg-white/95 px-6 py-5 text-center shadow-sm">
                <div className="text-lg font-semibold text-slate-950">
                  Drop files to upload to {currentPath.at(-1)?.name ?? "Shared drive"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Files from your computer will be added directly to this folder.
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/65">Company drive</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Shared Workspace</h1>
              <p className="mt-2 text-sm text-white/75">Organize company files with folders, browse them visually, and preview common formats before downloading.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15" onClick={() => setFolderOpen(true)}>
                <Plus className="mr-2 size-4" />
                New folder
              </Button>
              <Button className="bg-white text-slate-950 hover:bg-white/90" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-2 size-4" />
                {dropUploadMutation.isPending ? `Uploading ${pendingUploadCount}...` : "Upload file"}
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-white/60">Files</div>
              <div className="mt-2 text-3xl font-semibold">{documents.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-white/60">Folders</div>
              <div className="mt-2 text-3xl font-semibold">{folders.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-white/60">Visibility</div>
              <div className="mt-2 flex items-center gap-2 text-xl font-semibold">
                <Users className="size-5 text-emerald-300" />
                Everyone in company
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Folders</CardTitle>
              <CardDescription>Use folders like a shared drive.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[60vh] pr-3">
                <FolderTree
                  folders={folders}
                  activeFolderId={activeFolderId}
                  onSelect={setActiveFolderId}
                  onDropDocument={moveDocumentToFolder}
                  dragTargetFolderId={dragTargetFolderId}
                  setDragTargetFolderId={setDragTargetFolderId}
                />
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-200 bg-white">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div
                  className={`min-w-0 rounded-xl p-2 transition ${dragTargetFolderId === activeFolderId ? "bg-slate-100 ring-2 ring-slate-300" : ""}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={() => setDragTargetFolderId(activeFolderId)}
                  onDragLeave={() => setDragTargetFolderId(undefined)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const documentId = Number(event.dataTransfer.getData("text/workspace-document-id"));
                    setDragTargetFolderId(undefined);
                    if (Number.isFinite(documentId)) {
                      moveDocumentToFolder(documentId, activeFolderId);
                    }
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <button type="button" className="hover:text-slate-950" onClick={() => setActiveFolderId(null)}>Shared drive</button>
                    {currentPath.map((folder) => (
                      <React.Fragment key={folder.id}>
                        <ChevronRight className="size-4" />
                        <button type="button" className="hover:text-slate-950" onClick={() => setActiveFolderId(folder.id)}>
                          {folder.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="text-xl font-semibold text-slate-950">{currentPath.at(-1)?.name ?? "Shared drive"}</div>
                    {currentPath.at(-1) ? <FolderActions folder={currentPath.at(-1)!} /> : null}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Drag existing workspace files onto this header to move them here.</div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search files and folders" className="pl-9" />
                  </div>
                  <div className="flex gap-2">
                    <Button variant={viewMode === "grid" ? "default" : "outline"} size="icon" onClick={() => setViewMode("grid")}>
                      <Grid2X2 className="size-4" />
                    </Button>
                    <Button variant={viewMode === "list" ? "default" : "outline"} size="icon" onClick={() => setViewMode("list")}>
                      <LayoutList className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {workspaceQuery.isLoading ? (
              <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-sm text-muted-foreground">Loading shared drive...</div>
            ) : workspaceQuery.isError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{(workspaceQuery.error as Error)?.message ?? "Unable to load shared workspace."}</div>
            ) : childFolders.length === 0 && visibleDocuments.length === 0 ? (
              <Empty className="rounded-2xl border border-dashed bg-white py-16">
                <EmptyHeader>
                  <EmptyMedia>
                    <FolderOpen className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>No content here yet</EmptyTitle>
                  <EmptyDescription>Create a folder or upload a file to start building out the shared drive.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-5">
                {childFolders.length > 0 ? (
                  <section>
                    <div className="mb-3 text-sm font-medium text-slate-700">Folders</div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {childFolders.map((folder) => (
                        <div
                          key={folder.id}
                          onDragOver={(event) => event.preventDefault()}
                          onDragEnter={() => setDragTargetFolderId(folder.id)}
                          onDragLeave={() => setDragTargetFolderId(undefined)}
                          onDrop={(event) => {
                            event.preventDefault();
                            const documentId = Number(event.dataTransfer.getData("text/workspace-document-id"));
                            setDragTargetFolderId(undefined);
                            if (Number.isFinite(documentId)) {
                              moveDocumentToFolder(documentId, folder.id);
                            }
                          }}
                          className={`rounded-2xl border bg-white p-4 transition hover:border-slate-300 hover:shadow-sm ${
                            dragTargetFolderId === folder.id ? "border-slate-400 ring-2 ring-slate-300" : "border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveFolderId(folder.id)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                                <Folder className="size-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-medium text-slate-950">{folder.name}</div>
                                <div className="text-sm text-muted-foreground">Created {formatDate(folder.createdAt)}</div>
                              </div>
                            </button>
                            <FolderActions folder={folder} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {visibleDocuments.length > 0 ? (
                  <section>
                    <div className="mb-3 text-sm font-medium text-slate-700">Files</div>
                    {viewMode === "grid" ? (
                      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                        {visibleDocuments.map((document) => (
                          <DocumentGridCard key={document.id} document={document} />
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl border bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Folder</TableHead>
                              <TableHead>Uploaded by</TableHead>
                              <TableHead>Uploaded</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visibleDocuments.map((document) => {
                              const Icon = getDocumentIcon(document);
                              const folderPath = getFolderPath(document.folderId, folders).map((folder) => folder.name).join(" / ") || "Root";
                              return (
                                <TableRow key={document.id}>
                                  <TableCell>
                                    <div
                                      draggable
                                      onDragStart={(event) => beginDrag(event, document.id)}
                                      onDragEnd={() => setDragTargetFolderId(undefined)}
                                      className="flex items-center gap-3"
                                    >
                                      <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                        <Icon className="size-4" />
                                      </div>
                                      <div>
                                        <div className="font-medium text-slate-950">{document.title}</div>
                                        <div className="text-sm text-muted-foreground">{document.fileName}</div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>{folderPath}</TableCell>
                                  <TableCell>{document.uploadedBy}</TableCell>
                                  <TableCell>{formatDate(document.createdAt)}</TableCell>
                                  <TableCell>{formatFileSize(document.sizeBytes)}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button size="sm" variant="outline" onClick={() => setPreviewDocumentId(document.id)}>
                                        <Eye className="mr-2 size-4" />
                                        Preview
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => openDownload(document.id)}>
                                        <Download className="mr-2 size-4" />
                                        Download
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setDeleteTarget({ kind: "document", item: document })}>
                                        <Trash2 className="mr-2 size-4" />
                                        Delete
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} folders={folders} defaultFolderId={activeFolderId} onUploaded={refresh} uploadedBy={actorName} />
        <CreateFolderDialog open={folderOpen} onOpenChange={setFolderOpen} parentId={activeFolderId} onCreated={refresh} createdBy={actorName} />
        <RenameFolderDialog folder={folderToEdit} open={renameFolderOpen} onOpenChange={setRenameFolderOpen} onRenamed={refresh} />
        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteTarget?.kind === "folder" ? "Delete folder?" : "Delete file?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.kind === "folder"
                  ? deleteTarget.item.parentId === null
                    ? `Delete "${deleteTarget.item.name}"? Its files and subfolders will move to the shared drive root.`
                    : `Delete "${deleteTarget.item.name}"? Its files and subfolders will move up to the parent folder.`
                  : deleteTarget
                    ? `Delete "${deleteTarget.item.title}"? This cannot be undone.`
                    : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteTarget} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <PreviewDialog documentId={previewDocumentId} onOpenChange={(open) => !open && setPreviewDocumentId(null)} />
      </div>
    </AppLayout>
  );
}

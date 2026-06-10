import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./http";

export interface CollaborationPerson {
  id: number;
  name: string;
  email?: string;
  source?: string;
}

export interface CollaborativeTask {
  id: number;
  title: string;
  notes: string | null;
  priority: "high" | "medium" | "low";
  category: "Accounts" | "Forecast" | "Internal" | "Follow-up";
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  createdBy: CollaborationPerson;
  assignees: CollaborationPerson[];
}

export interface PosterPost {
  id: number;
  postType: "announcement" | "headline" | "reminder";
  title: string;
  body: string;
  includeAllUsers: boolean;
  createdAt: string;
  createdBy: CollaborationPerson;
  targets: CollaborationPerson[];
}

export interface TaskInput {
  title: string;
  notes: string | null;
  priority: CollaborativeTask["priority"];
  category: CollaborativeTask["category"];
}

export interface PosterInput {
  postType: PosterPost["postType"];
  title: string;
  body: string;
  includeAllUsers: boolean;
  targetUserIds: number[];
}

export function getCollaborationTasks() {
  return fetchJson<CollaborativeTask[]>("/api/collaboration/tasks");
}

export function createCollaborationTask(input: TaskInput) {
  return fetchJson<CollaborativeTask>("/api/collaboration/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCollaborationTask(taskId: number, completed: boolean) {
  return fetchJson<void>(`/api/collaboration/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ completed }),
  });
}

export function deleteCollaborationTask(taskId: number) {
  return fetchJson<void>(`/api/collaboration/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export function getPosterBoardPosts() {
  return fetchJson<PosterPost[]>("/api/collaboration/poster-board");
}

export function createPosterBoardPost(input: PosterInput) {
  return fetchJson<PosterPost>("/api/collaboration/poster-board", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function useCollaborationTasks() {
  return useQuery({
    queryKey: ["collaboration", "tasks"],
    queryFn: getCollaborationTasks,
  });
}

export function usePosterBoardPosts() {
  return useQuery({
    queryKey: ["collaboration", "poster-board"],
    queryFn: getPosterBoardPosts,
  });
}

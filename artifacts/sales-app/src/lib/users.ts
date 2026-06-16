import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./http";

export type UserRole = "admin" | "sales_rep";
export type UserStatus = "active" | "inactive";
export type UserAuthMode = "password" | "setup_required";

export interface ClarityUser {
  id: number;
  salesRepId: number | null;
  name: string;
  email: string;
  phone: string | null;
  title: string;
  role: UserRole;
  status: UserStatus;
  authMode: UserAuthMode;
  passwordResetRequired: boolean;
  lastActiveAt: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserInput {
  name: string;
  email: string;
  phone: string | null;
  title: string;
  status: UserStatus;
}

export interface UserCreateInput extends UserInput {
}

export interface UserPinResponse extends ClarityUser {
  temporaryPin: string;
}

export interface VisibleUser {
  id: number;
  name: string;
  email: string;
  title: string;
  role: UserRole;
  authMode: UserAuthMode;
}

export function getCurrentUser() {
  return fetchJson<ClarityUser>("/api/users/me");
}

export function listUsers() {
  return fetchJson<ClarityUser[]>("/api/users");
}

export function listAllVisibleUsers() {
  return fetchJson<VisibleUser[]>("/api/auth/login-options");
}

export function createUser(input: UserCreateInput) {
  return fetchJson<UserPinResponse>("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateUser(userId: number, input: UserInput) {
  return fetchJson<ClarityUser>(`/api/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function resetUserPassword(userId: number) {
  return fetchJson<UserPinResponse>(`/api/users/${userId}/reset-password`, {
    method: "POST",
  });
}

export function removeUser(userId: number) {
  return fetchJson<void>(`/api/users/${userId}`, {
    method: "DELETE",
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["users", "me"],
    queryFn: getCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users", "all-visible"],
    queryFn: listAllVisibleUsers,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

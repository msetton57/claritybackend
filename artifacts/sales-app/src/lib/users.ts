import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./http";

export type UserRole = "admin" | "sales_rep";
export type UserStatus = "active" | "inactive";

export interface ClarityUser {
  id: number;
  salesRepId: number | null;
  name: string;
  email: string;
  phone: string | null;
  title: string;
  role: UserRole;
  status: UserStatus;
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
  pin?: string;
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

export function resetUserPin(userId: number, pin: string) {
  return fetchJson<UserPinResponse>(`/api/users/${userId}/reset-pin`, {
    method: "POST",
    body: JSON.stringify({ pin }),
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

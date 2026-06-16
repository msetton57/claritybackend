import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "./http";
import type { ClarityUser } from "./users";

type LoginOption = Pick<ClarityUser, "id" | "name" | "email" | "title" | "role">;

type SessionResponse = {
  user: ClarityUser;
};

export function getLoginOptions() {
  return fetchJson<LoginOption[]>("/api/auth/login-options");
}

export function getSession() {
  return fetchJson<SessionResponse>("/api/auth/session");
}

export function login(input: { email: string; password: string }) {
  return fetchJson<SessionResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function setupPassword(input: { password: string; confirmPassword: string }) {
  return fetchJson<SessionResponse>("/api/auth/setup-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout() {
  return fetchJson<void>("/api/auth/logout", {
    method: "POST",
  });
}

export function useSession() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: getSession,
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: login,
    onSuccess: async (payload) => {
      queryClient.setQueryData(["auth", "session"], payload);
      queryClient.setQueryData(["users", "me"], payload.user);
      await queryClient.invalidateQueries();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      queryClient.setQueryData(["auth", "session"], null);
      queryClient.removeQueries({ queryKey: ["users", "me"] });
      await queryClient.invalidateQueries();
    },
  });
}

export function useSetupPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setupPassword,
    onSuccess: async (payload) => {
      queryClient.setQueryData(["auth", "session"], payload);
      queryClient.setQueryData(["users", "me"], payload.user);
      await queryClient.invalidateQueries();
    },
  });
}

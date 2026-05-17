import { api, clearAuth, getStoredUser } from "@/lib/api";
import { useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/" } =
    options ?? {};
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: api.me,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Logout should clear local state even if the remote session is already gone.
    } finally {
      clearAuth();
    }
  }, []);

  const state = useMemo(() => {
    const user = meQuery.data ?? getStoredUser();
    localStorage.setItem(
      "cipher-collab-user-info",
      JSON.stringify(user)
    );
    return {
      user,
      loading: meQuery.isLoading,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    meQuery.isLoading,
    state.user,
  ]);

  // FIXED: removed OAuth redirect dependency from username/password auth flow

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}

"use client";

import type { SsoSessionUser } from "@hams-fam/sso-client";
import { create } from "zustand";

type AuthState = {
  user: SsoSessionUser | null;
  authChecked: boolean;
  initAuth: () => Promise<void>;
  clearUser: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  authChecked: false,

  initAuth: async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) throw new Error("session_lookup_failed");

      const result = (await response.json()) as {
        user?: SsoSessionUser | null;
      };
      set({ user: result.user ?? null, authChecked: true });
    } catch {
      set({ user: null, authChecked: true });
    }
  },

  clearUser: () => set({ user: null, authChecked: true }),
}));

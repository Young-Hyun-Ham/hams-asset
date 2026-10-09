"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/store/auth-store";

export default function AuthInitializer() {
  const initAuth = useAuthStore((state) => state.initAuth);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  return null;
}

"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME_ID, getStoredPastelTheme } from "./pastel-themes";

function subscribeToTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("snapweed-theme-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("snapweed-theme-change", callback);
    window.removeEventListener("storage", callback);
  };
}

export function useStoredPastelTheme(): string {
  return useSyncExternalStore(
    subscribeToTheme,
    getStoredPastelTheme,
    () => DEFAULT_THEME_ID
  );
}


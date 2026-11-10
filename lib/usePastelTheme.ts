"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_THEME_ID,
  DEFAULT_THEME_MODE,
  ThemeMode,
  getStoredPastelTheme,
  getStoredThemeMode,
} from "./pastel-themes";

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

export function useStoredThemeMode(): ThemeMode {
  return useSyncExternalStore(
    subscribeToTheme,
    getStoredThemeMode,
    () => DEFAULT_THEME_MODE
  );
}

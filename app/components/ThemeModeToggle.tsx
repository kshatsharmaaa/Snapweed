"use client";

import { applyThemeMode } from "@/lib/pastel-themes";
import { useStoredThemeMode } from "@/lib/usePastelTheme";
import { updateUserProfile } from "@/lib/user-profile";

interface ThemeModeToggleProps {
  uid?: string;
  compact?: boolean;
}

export function ThemeModeToggle({ uid, compact = false }: ThemeModeToggleProps) {
  const mode = useStoredThemeMode();
  const isDark = mode === "dark";

  const handleToggle = () => {
    const nextMode = isDark ? "light" : "dark";
    applyThemeMode(nextMode);
    if (uid) {
      updateUserProfile(uid, { darkMode: nextMode === "dark" }).catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`rounded-full border transition-all shadow-2xs hover:opacity-85 cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold shrink-0 ${
        compact ? "p-2" : "p-2 sm:px-3 sm:py-1.5"
      }`}
      style={{
        backgroundColor: isDark ? "var(--pastel-primary)" : "var(--pastel-tint)",
        borderColor: isDark ? "var(--pastel-primary)" : "var(--pastel-border)",
        color: isDark ? "#ffffff" : "var(--pastel-text)",
      }}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
      {!compact && <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>}
    </button>
  );
}


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
    <div className="flex items-center gap-2 shrink-0">
      {!compact && (
        <span
          className="hidden sm:flex items-center justify-center transition-colors"
          style={{ color: "var(--pastel-text)", opacity: isDark ? 0.6 : 1 }}
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
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
        </span>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        onClick={handleToggle}
        className={`group relative rounded-full flex items-center cursor-pointer transition-all duration-200 portfolio-shadow border-0 ${
          compact ? "w-11 h-6" : "w-14 h-7"
        }`}
        style={{
          backgroundColor: "var(--pastel-primary)",
        }}
        title={isDark ? "Switch to light cream theme" : "Switch to pastel dusk theme"}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        <span
          className={`rounded-full transition-transform duration-200 ease-in-out group-hover:scale-90 flex items-center justify-center shadow-xs ${
            compact
              ? `w-4 h-4 ml-1 ${isDark ? "translate-x-5" : "translate-x-0"}`
              : `w-5 h-5 ml-1.5 ${isDark ? "translate-x-6" : "translate-x-0"}`
          }`}
          style={{
            backgroundColor: "var(--pastel-bg)",
            color: "var(--pastel-text)",
          }}
        >
          {compact && (
            isDark ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
              </svg>
            )
          )}
        </span>
      </button>

      {!compact && (
        <span
          className="hidden sm:flex items-center justify-center transition-colors"
          style={{ color: "var(--pastel-text)", opacity: isDark ? 1 : 0.6 }}
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        </span>
      )}
    </div>
  );
}

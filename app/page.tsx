"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { updateUserProfile } from "@/lib/user-profile";
import {
  PASTEL_THEMES,
  applyPastelTheme,
  getPastelPalette,
} from "@/lib/pastel-themes";
import { useStoredPastelTheme, useStoredThemeMode } from "@/lib/usePastelTheme";
import { ThemeModeToggle } from "./components/ThemeModeToggle";

export default function Home() {
  const activeTheme = useStoredPastelTheme();
  const activeMode = useStoredThemeMode();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    applyPastelTheme(activeTheme, activeMode);
  }, [activeTheme, activeMode]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  const handleChooseTheme = async (themeId: string) => {
    applyPastelTheme(themeId, activeMode);

    if (currentUser) {
      try {
        await updateUserProfile(currentUser.uid, { themeColor: themeId });
      } catch (err) {
        console.error("Failed to save theme to user profile:", err);
      }
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col justify-between transition-colors duration-300"
      style={{ backgroundColor: "var(--pastel-bg)", color: "var(--pastel-text)" }}
    >
      {/* Navigation */}
      <nav className="w-full max-w-5xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight" style={{ color: "var(--pastel-text)" }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--pastel-primary)" }} aria-hidden="true" />
          <span>snapweed</span>
        </div>
        
        <div className="flex items-center gap-3">
          <ThemeModeToggle uid={currentUser?.uid} />
          {currentUser ? (
            <>
              <Link
                href="/suggestions"
                className="text-xs sm:text-sm font-bold px-3 py-2 rounded-full transition-opacity hover:opacity-80"
                style={{ color: "var(--pastel-accent-text)" }}
              >
                Suggestions
              </Link>
              <Link
                href="/dashboard"
                className="text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full transition-all portfolio-shadow hover:opacity-95"
                style={{
                  backgroundColor: "var(--pastel-primary)",
                  color: "var(--pastel-on-primary)",
                }}
              >
                Open Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs sm:text-sm font-bold px-3 py-2 rounded-full transition-opacity hover:opacity-80"
                style={{ color: "var(--pastel-accent-text)" }}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full transition-all portfolio-shadow hover:opacity-95"
                style={{
                  backgroundColor: "var(--pastel-primary)",
                  color: "var(--pastel-on-primary)",
                }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-3xl mx-auto px-6 text-center my-auto py-10">
        
        {/* Tri-Pastel Editorial Bar */}
        <div className="flex items-center justify-center gap-2 mb-6" aria-hidden="true">
          <span className="h-1 w-8 rounded-full" style={{ backgroundColor: "var(--portfolio-pink)" }} />
          <span className="h-1 w-8 rounded-full" style={{ backgroundColor: "var(--portfolio-green)" }} />
          <span className="h-1 w-8 rounded-full" style={{ backgroundColor: "var(--portfolio-blue)" }} />
        </div>

        {/* Overview Pill */}
        <div 
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6 portfolio-shadow transition-colors"
          style={{ 
            backgroundColor: "var(--pastel-card)", 
            color: "var(--pastel-accent-text)" 
          }}
        >
          <span>real-time chat &bull; logs &bull; music &bull; Q&amp;A</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight mb-4 transition-colors">
          chat, share music, and write freely.
        </h1>

        <p 
          className="text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed font-medium transition-colors"
          style={{ color: "var(--pastel-subtext)" }}
        >
          Private real-time chat rooms, daily logs, music recommendations, and community Q&amp;A.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href={currentUser ? "/dashboard" : "/signup"}
            className="w-full sm:w-auto px-7 py-3 font-bold rounded-full portfolio-shadow hover:opacity-95 transition-all text-sm"
            style={{
              backgroundColor: "var(--pastel-primary)",
              color: "var(--pastel-on-primary)",
            }}
          >
            {currentUser ? "Go to Dashboard →" : "Get Started"}
          </Link>
          {!currentUser && (
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 bg-[var(--pastel-card)] font-bold rounded-full transition-all text-sm hover:opacity-90 portfolio-shadow"
              style={{ color: "var(--pastel-text)" }}
            >
              I Have an Account →
            </Link>
          )}
        </div>

        {/* Minimalist Floating Theme Swatches directly on canvas */}
        <div className="mt-12 flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[var(--pastel-card)] portfolio-shadow">
            {Object.values(PASTEL_THEMES).map((th) => {
              const isSelected = activeTheme === th.id;
              const palette = getPastelPalette(th.id, activeMode);
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => handleChooseTheme(th.id)}
                  className={`w-6 h-6 rounded-full transition-all cursor-pointer ${
                    isSelected 
                      ? "scale-115 ring-2 ring-[var(--pastel-text)] ring-offset-2 ring-offset-[var(--pastel-card)]" 
                      : "opacity-75 hover:opacity-100 hover:scale-105"
                  }`}
                  style={{
                    backgroundColor: palette.primary,
                  }}
                  title={th.name}
                  aria-label={`Switch to ${th.name}`}
                  aria-pressed={isSelected}
                />
              );
            })}
          </div>
          <span className="text-xs font-semibold" style={{ color: "var(--pastel-subtext)" }}>
            Theme: <span style={{ color: "var(--pastel-accent-text)" }}>{PASTEL_THEMES[activeTheme]?.name || "Blush Pink"}</span>
          </span>
        </div>

      </main>

      {/* Footer */}
      <footer 
        className="py-6 text-center text-xs transition-colors flex flex-col sm:flex-row items-center justify-center gap-2"
        style={{ color: "var(--pastel-subtext)" }}
      >
        <span>snapweed</span>
        {currentUser && (
          <>
            <span className="hidden sm:inline">&bull;</span>
            <Link href="/suggestions" className="font-bold underline hover:opacity-80" style={{ color: "var(--pastel-accent-text)" }}>
              Feedback &amp; Suggestions
            </Link>
          </>
        )}
      </footer>
    </div>
  );
}

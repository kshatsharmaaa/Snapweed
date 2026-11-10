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
      className="min-h-screen flex flex-col justify-between transition-colors duration-200"
      style={{ backgroundColor: "var(--pastel-bg)", color: "var(--pastel-text)" }}
    >
      {/* Navigation */}
      <nav className="w-full max-w-5xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="text-2xl font-black tracking-tight" style={{ color: "var(--pastel-primary)" }}>
          <span>snapweed</span>
        </div>
        
        <div className="flex items-center gap-2.5">
          <ThemeModeToggle uid={currentUser?.uid} />
          {currentUser ? (
            <>
              <Link
                href="/suggestions"
                className="text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-colors hover:opacity-80"
                style={{ color: "var(--pastel-subtext)" }}
              >
                Suggestions
              </Link>
              <Link
                href="/dashboard"
                className="text-xs sm:text-sm font-bold text-white px-4 py-2.5 rounded-2xl transition-all shadow-xs"
                style={{ backgroundColor: "var(--pastel-primary)" }}
              >
                Open Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs sm:text-sm font-bold px-3 py-2 rounded-xl transition-colors hover:opacity-80"
                style={{ color: "var(--pastel-subtext)" }}
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="text-xs sm:text-sm font-bold text-white px-4 py-2.5 rounded-2xl transition-all shadow-xs hover:opacity-95"
                style={{ backgroundColor: "var(--pastel-primary)" }}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-3xl mx-auto px-6 text-center my-auto py-10">
        
        {/* Vibe Pill */}
        <div 
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-6 border shadow-2xs transition-colors"
          style={{ 
            backgroundColor: "var(--pastel-tint)", 
            borderColor: "var(--pastel-border)", 
            color: "var(--pastel-primary)" 
          }}
        >
          <span>real-time chat &bull; personal logs &bull; songs &bull; vibes</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight mb-4 transition-colors">
          your cozy corner on the internet ~
        </h1>

        <p 
          className="text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed font-medium transition-colors"
          style={{ color: "var(--pastel-subtext)" }}
        >
          A gentle personal space to chat with friends in real-time, share your favorite songs, write unfiltered daily logs, and answer questions.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href={currentUser ? "/dashboard" : "/signup"}
            className="w-full sm:w-auto px-7 py-3.5 text-white font-bold rounded-2xl shadow-sm hover:shadow-md hover:opacity-95 transition-all text-sm"
            style={{ backgroundColor: "var(--pastel-primary)" }}
          >
            {currentUser ? "Go to your cozy space →" : "Get Started (It's Free)"}
          </Link>
          {!currentUser && (
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3.5 bg-[var(--pastel-card)] border font-bold rounded-2xl transition-all text-sm hover:opacity-90"
              style={{ borderColor: "var(--pastel-border)", color: "var(--pastel-text)" }}
            >
              I Have an Account →
            </Link>
          )}
        </div>

        {/* 6 Curated Pastel Theme Buttons on the start of the screen itself */}
        <div 
          className="mt-12 p-4 sm:p-5 rounded-3xl border shadow-xs max-w-xl mx-auto backdrop-blur-sm transition-all"
          style={{ 
            backgroundColor: "var(--pastel-card)", 
            borderColor: "var(--pastel-border)" 
          }}
        >
          <div className="mb-3 text-center">
            <span className="text-xs font-bold block" style={{ color: "var(--pastel-text)" }}>
              Choose your pastel theme:
            </span>
            <span className="text-[11px]" style={{ color: "var(--pastel-subtext)" }}>
              Pick a theme to color your entire snapweed space
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.values(PASTEL_THEMES).map((th) => {
              const isSelected = activeTheme === th.id;
              const palette = getPastelPalette(th.id, activeMode);
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => handleChooseTheme(th.id)}
                  className={`py-2 px-3 rounded-2xl text-xs font-bold flex items-center justify-between transition-all border shadow-2xs cursor-pointer ${
                    isSelected 
                      ? "ring-2 scale-102 shadow-xs" 
                      : "opacity-85 hover:opacity-100 hover:scale-101"
                  }`}
                  style={{
                    backgroundColor: palette.tint,
                    borderColor: isSelected ? palette.primary : palette.border,
                    color: palette.text,
                    outlineColor: palette.primary,
                  }}
                  title={`Switch to ${th.name}`}
                >
                  <span className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full shrink-0 border"
                      style={{ backgroundColor: palette.primary, borderColor: palette.border }}
                    />
                    <span>{th.name}</span>
                  </span>
                  {isSelected ? (
                    <span 
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-white"
                      style={{ backgroundColor: palette.primary }}
                    >
                      Active
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer 
        className="py-6 text-center text-xs transition-colors flex flex-col sm:flex-row items-center justify-center gap-2"
        style={{ color: "var(--pastel-subtext)" }}
      >
        <span>made with love for fun ~ snapweed</span>
        {currentUser && (
          <>
            <span className="hidden sm:inline">&bull;</span>
            <Link href="/suggestions" className="font-bold underline hover:opacity-80" style={{ color: "var(--pastel-primary)" }}>
              Feedback &amp; Suggestions
            </Link>
          </>
        )}
      </footer>
    </div>
  );
}

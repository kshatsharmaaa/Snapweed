"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile } from "@/lib/user-profile";
import {
  applyPastelTheme,
  getStoredPastelTheme,
  getStoredThemeMode,
} from "@/lib/pastel-themes";
import { FeedbackBoard } from "@/app/components/FeedbackBoard";
import { ThemeModeToggle } from "@/app/components/ThemeModeToggle";

export default function SuggestionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    applyPastelTheme(getStoredPastelTheme(), getStoredThemeMode());

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        if (profile?.name || profile?.username) {
          setDisplayName(profile.name || profile.username);
        } else {
          setDisplayName(currentUser.email?.split("@")[0] || "Member");
        }
        const preferredMode =
          typeof profile?.darkMode === "boolean"
            ? profile.darkMode
              ? "dark"
              : "light"
            : getStoredThemeMode();
        if (profile?.themeColor) {
          applyPastelTheme(profile.themeColor, preferredMode);
        } else {
          applyPastelTheme(getStoredPastelTheme(), preferredMode);
        }
        setLoading(false);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center transition-colors"
        style={{
          backgroundColor: "var(--pastel-bg)",
          color: "var(--pastel-subtext)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2" aria-hidden="true">
            <span className="portfolio-dot" />
            <span className="portfolio-dot" />
            <span className="portfolio-dot" />
          </div>
          <span className="text-xs font-bold tracking-wide uppercase">loading suggestions...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen transition-colors duration-200 pb-16"
      style={{
        backgroundColor: "var(--pastel-bg)",
        color: "var(--pastel-text)",
      }}
    >
      {/* Top Navbar */}
      <nav
        className="w-full backdrop-blur-md px-4 sm:px-6 py-3 sticky top-0 z-30 transition-colors"
        style={{
          backgroundColor: "var(--pastel-nav)",
        }}
      >
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link
            href="/dashboard"
            className="text-xl font-extrabold tracking-tight"
            style={{ color: "var(--pastel-text)" }}
          >
            snapweed
          </Link>

          <div className="flex items-center gap-3">
            <ThemeModeToggle uid={user.uid} />
            <Link
              href="/dashboard"
              className="text-xs font-bold px-4 py-2 rounded-full portfolio-shadow hover:opacity-95 transition-all"
              style={{
                backgroundColor: "var(--pastel-primary)",
                color: "var(--pastel-on-primary)",
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-5">
        <div className="px-1">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "var(--pastel-text)" }}>
            Feedback &amp; Suggestions
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--pastel-subtext)" }}>
            Share feedback, bug reports, or feature requests
          </p>
        </div>
        <FeedbackBoard currentName={displayName} />
      </main>
    </div>
  );
}

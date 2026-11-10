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
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--pastel-primary)", borderTopColor: "transparent" }}
          />
          <span className="text-xs font-bold">loading suggestions...</span>
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
        className="w-full backdrop-blur-md border-b px-4 sm:px-6 py-3 sticky top-0 z-30 transition-colors"
        style={{
          backgroundColor: "var(--pastel-nav)",
          borderColor: "var(--pastel-border)",
        }}
      >
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link
            href="/dashboard"
            className="text-xl font-black tracking-tight"
            style={{ color: "var(--pastel-primary)" }}
          >
            snapweed
          </Link>

          <div className="flex items-center gap-2.5">
            <ThemeModeToggle uid={user.uid} />
            <Link
              href="/dashboard"
              className="text-xs font-bold text-white px-4 py-2 rounded-2xl shadow-xs hover:opacity-95 transition-all"
              style={{ backgroundColor: "var(--pastel-primary)" }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <FeedbackBoard currentName={displayName} />
      </main>
    </div>
  );
}

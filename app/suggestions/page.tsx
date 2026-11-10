"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile } from "@/lib/user-profile";
import { applyPastelTheme, getStoredPastelTheme } from "@/lib/pastel-themes";
import { FeedbackBoard } from "@/app/components/FeedbackBoard";

export default function SuggestionsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    applyPastelTheme(getStoredPastelTheme());

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const profile = await getUserProfile(currentUser.uid);
        if (profile?.name || profile?.username) {
          setDisplayName(profile.name || profile.username);
        } else {
          setDisplayName(currentUser.email?.split("@")[0] || "Member");
        }
        if (profile?.themeColor) {
          applyPastelTheme(profile.themeColor);
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
          colorScheme: "light",
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
        colorScheme: "light",
      }}
    >
      {/* Top Navbar */}
      <nav
        className="w-full bg-white/85 backdrop-blur-md border-b px-4 sm:px-6 py-3 sticky top-0 z-30"
        style={{ borderColor: "var(--pastel-border)" }}
      >
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link
            href="/dashboard"
            className="text-xl font-black tracking-tight"
            style={{ color: "var(--pastel-primary)" }}
          >
            snapweed
          </Link>

          <Link
            href="/dashboard"
            className="text-xs font-bold text-white px-4 py-2 rounded-2xl shadow-xs hover:opacity-95 transition-all"
            style={{ backgroundColor: "var(--pastel-primary)" }}
          >
            Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8">
        <FeedbackBoard currentName={displayName} />
      </main>
    </div>
  );
}

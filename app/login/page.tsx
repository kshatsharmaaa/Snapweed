"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PASTEL_THEMES,
  applyPastelTheme,
  getPastelPalette,
  getStoredThemeMode,
} from "@/lib/pastel-themes";
import { useStoredPastelTheme, useStoredThemeMode } from "@/lib/usePastelTheme";
import { ThemeModeToggle } from "@/app/components/ThemeModeToggle";

export default function Login() {
  const [usernameInput, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const activeTheme = useStoredPastelTheme();
  const activeMode = useStoredThemeMode();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    applyPastelTheme(activeTheme, activeMode);
  }, [activeTheme, activeMode]);

  const handleSelectTheme = (themeId: string) => {
    applyPastelTheme(themeId, activeMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanInput = usernameInput.trim().toLowerCase().replace(/^@/, "");

    try {
      await setPersistence(auth, browserSessionPersistence);

      // 1. Try standard snapweed.app internal username email
      const candidateEmail = cleanInput.includes("@")
        ? cleanInput
        : `${cleanInput}@snapweed.app`;

      try {
        const userCredential = await signInWithEmailAndPassword(auth, candidateEmail, password);
        // Load user's saved theme & mode if configured
        try {
          const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
          if (userDoc.exists()) {
            const d = userDoc.data();
            const prefMode =
              typeof d.darkMode === "boolean"
                ? d.darkMode
                  ? "dark"
                  : "light"
                : getStoredThemeMode();
            applyPastelTheme(d.themeColor || activeTheme, prefMode);
          }
        } catch {
          // ignore profile theme load error
        }
        router.push("/dashboard");
        return;
      } catch (authErr: unknown) {
        // If not found and input didn't contain @, check if user exists in Firestore with legacy email
        if (!cleanInput.includes("@")) {
          const q = query(collection(db, "users"), where("username", "==", cleanInput));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const userData = querySnap.docs[0].data();
            if (userData.email) {
              await signInWithEmailAndPassword(auth, userData.email, password);
              const prefMode =
                typeof userData.darkMode === "boolean"
                  ? userData.darkMode
                    ? "dark"
                    : "light"
                  : getStoredThemeMode();
              applyPastelTheme(userData.themeColor || activeTheme, prefMode);
              router.push("/dashboard");
              return;
            }
          }
        }
        throw authErr;
      }
    } catch (err: unknown) {
      console.error("Login error:", err);
      setError("Incorrect username or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 transition-colors duration-200"
      style={{ backgroundColor: "var(--pastel-bg)", color: "var(--pastel-text)" }}
    >
      <div 
        className="relative max-w-md w-full bg-[var(--pastel-card)] portfolio-panel p-8 portfolio-shadow transition-all"
      >
        <div className="absolute top-5 right-5">
          <ThemeModeToggle compact />
        </div>
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-1.5 mb-3" aria-hidden="true">
            <span className="h-1 w-6 rounded-full" style={{ backgroundColor: "var(--portfolio-pink)" }} />
            <span className="h-1 w-6 rounded-full" style={{ backgroundColor: "var(--portfolio-green)" }} />
            <span className="h-1 w-6 rounded-full" style={{ backgroundColor: "var(--portfolio-blue)" }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--pastel-text)" }}>
            Welcome back
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--pastel-subtext)" }}>
            Log in to Snapweed
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 text-xs font-semibold rounded-2xl text-center"
            style={{
              backgroundColor: "var(--pastel-error-bg)",
              color: "var(--pastel-error-text)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Username */}
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: "var(--pastel-text)" }}>
              Username
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-sm font-bold" style={{ color: "var(--pastel-subtext)" }}>@</span>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 rounded-2xl bg-[var(--pastel-input)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] text-sm"
                style={{ color: "var(--pastel-text)" }}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: "var(--pastel-text)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-2xl bg-[var(--pastel-input)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] text-sm"
              style={{ color: "var(--pastel-text)" }}
              required
            />
          </div>

          {/* Quick pastel theme selector on login */}
          <div className="pt-1">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] font-bold" style={{ color: "var(--pastel-subtext)" }}>
                Theme:
              </span>
              <span className="text-[11px] font-bold" style={{ color: "var(--pastel-accent-text)" }}>
                {PASTEL_THEMES[activeTheme]?.name}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-full bg-[var(--pastel-input)]">
              {Object.values(PASTEL_THEMES).map((th) => {
                const palette = getPastelPalette(th.id, activeMode);
                const isActive = activeTheme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => handleSelectTheme(th.id)}
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer ${
                      isActive
                        ? "scale-115 ring-2 ring-[var(--pastel-text)] ring-offset-2 ring-offset-[var(--pastel-input)]"
                        : "opacity-75 hover:opacity-100 hover:scale-105"
                    }`}
                    style={{
                      backgroundColor: palette.primary,
                    }}
                    title={th.name}
                    aria-label={th.name}
                  />
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 font-bold rounded-full transition-all portfolio-shadow disabled:opacity-50 text-sm hover:opacity-95 cursor-pointer"
            style={{
              backgroundColor: "var(--pastel-primary)",
              color: "var(--pastel-on-primary)",
            }}
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--pastel-subtext)" }}>
          New here?{" "}
          <Link 
            href="/signup" 
            className="font-bold hover:underline"
            style={{ color: "var(--pastel-accent-text)" }}
          >
            Create an account
          </Link>
        </p>

      </div>
    </div>
  );
}

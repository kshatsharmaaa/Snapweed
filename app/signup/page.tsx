"use client";

import { useState, useEffect } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  setPersistence, 
  browserSessionPersistence 
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { claimUsername } from "@/lib/user-profile";
import { PASTEL_THEMES, applyPastelTheme, getPastelPalette } from "@/lib/pastel-themes";
import { useStoredPastelTheme, useStoredThemeMode } from "@/lib/usePastelTheme";
import { ThemeModeToggle } from "@/app/components/ThemeModeToggle";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const selectedTheme = useStoredPastelTheme();
  const activeMode = useStoredThemeMode();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    applyPastelTheme(selectedTheme, activeMode);
  }, [selectedTheme, activeMode]);

  const handleSelectTheme = (themeId: string) => {
    applyPastelTheme(themeId, activeMode);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (cleanUsername.length < 3) {
      setError("Username must be at least 3 characters (letters, numbers, underscores).");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      // 1. Set browser session persistence
      await setPersistence(auth, browserSessionPersistence);
      const internalEmail = `${cleanUsername}@snapweed.app`;

      let uid: string;

      // 2. Create user or recover if previous attempt already registered the auth account
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, internalEmail, password);
        uid = userCredential.user.uid;
      } catch (authErr: unknown) {
        const err = authErr as { code?: string; message?: string };
        if (err.code === "auth/email-already-in-use") {
          try {
            // Attempt to sign in if this was an incomplete signup from a previous attempt
            const signInCred = await signInWithEmailAndPassword(auth, internalEmail, password);
            uid = signInCred.user.uid;
          } catch {
            setError(`@${cleanUsername} is already taken! Please choose another username or log in.`);
            setLoading(false);
            return;
          }
        } else if (err.code === "auth/weak-password") {
          setError("Password should be at least 6 characters.");
          setLoading(false);
          return;
        } else {
          throw authErr;
        }
      }

      // 3. Save profile in Firestore users collection (with merge: true)
      try {
        await setDoc(doc(db, "users", uid), {
          uid,
          username: cleanUsername,
          name: name.trim() || cleanUsername,
          photoURL: "",
          favSong: "",
          themeColor: selectedTheme,
          darkMode: activeMode === "dark",
          createdAt: serverTimestamp(),
        }, { merge: true });
      } catch (firestoreErr) {
        console.warn("Firestore profile write notice:", firestoreErr);
      }

      // 4. Optionally claim username in usernames collection (safe, non-blocking)
      await claimUsername(cleanUsername, uid);

      // 5. Save theme to localStorage & apply
      applyPastelTheme(selectedTheme, activeMode);

      router.push("/dashboard");
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      console.error("Signup error:", err);
      setError(`Error: ${errorObj.message || "Failed to create account"}`);
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
            Create an account
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--pastel-subtext)" }}>
            Sign up for Snapweed
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

        <form onSubmit={handleSignup} className="space-y-4">
          
          {/* Username */}
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: "var(--pastel-text)" }}>
              Choose a Username *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-sm font-bold" style={{ color: "var(--pastel-subtext)" }}>@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 rounded-2xl bg-[var(--pastel-input)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] text-sm"
                style={{ 
                  color: "var(--pastel-text)"
                }}
                required
              />
            </div>
            <span className="text-[10px] mt-0.5 block" style={{ color: "var(--pastel-subtext)" }}>
              You will use this username to log in!
            </span>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: "var(--pastel-text)" }}>
              Your Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maya or Capybara"
              className="w-full px-4 py-3 rounded-2xl bg-[var(--pastel-input)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] text-sm"
              style={{ 
                color: "var(--pastel-text)"
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: "var(--pastel-text)" }}>
              Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full px-4 py-3 rounded-2xl bg-[var(--pastel-input)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] text-sm"
              style={{ 
                color: "var(--pastel-text)"
              }}
              required
            />
          </div>

          {/* Initial Pastel Theme Choice */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold" style={{ color: "var(--pastel-text)" }}>
                Theme:
              </label>
              <span className="text-[11px] font-bold" style={{ color: "var(--pastel-accent-text)" }}>
                {PASTEL_THEMES[selectedTheme]?.name}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-full bg-[var(--pastel-input)]">
              {Object.values(PASTEL_THEMES).map((th) => {
                const palette = getPastelPalette(th.id, activeMode);
                const isActive = selectedTheme === th.id;
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
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--pastel-subtext)" }}>
          Already have an account?{" "}
          <Link 
            href="/login" 
            className="font-bold hover:underline"
            style={{ color: "var(--pastel-accent-text)" }}
          >
            Log in here
          </Link>
        </p>

      </div>
    </div>
  );
}

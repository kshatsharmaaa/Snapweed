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
import { PASTEL_THEMES, applyPastelTheme } from "@/lib/pastel-themes";
import { useStoredPastelTheme } from "@/lib/usePastelTheme";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const selectedTheme = useStoredPastelTheme();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    applyPastelTheme(selectedTheme);
  }, [selectedTheme]);

  const handleSelectTheme = (themeId: string) => {
    applyPastelTheme(themeId);
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
          createdAt: serverTimestamp(),
        }, { merge: true });
      } catch (firestoreErr) {
        console.warn("Firestore profile write notice:", firestoreErr);
      }

      // 4. Optionally claim username in usernames collection (safe, non-blocking)
      await claimUsername(cleanUsername, uid);

      // 5. Save theme to localStorage & apply
      applyPastelTheme(selectedTheme);

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
        className="max-w-md w-full bg-white rounded-3xl p-8 border shadow-sm transition-all"
        style={{ borderColor: "var(--pastel-border)" }}
      >
        
        {/* Cozy Logo & Header */}
        <div className="text-center mb-6">
          <div 
            className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center font-black text-xl shadow-xs transition-colors"
            style={{ backgroundColor: "var(--pastel-tint)", color: "var(--pastel-primary)" }}
          >
            S
          </div>
          <h1 className="text-2xl font-black" style={{ color: "var(--pastel-text)" }}>
            join snapweed ~
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--pastel-subtext)" }}>
            your cozy corner for real-time chats, songs &amp; thoughts
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs font-semibold text-[#8a223a] bg-[#feebee] rounded-2xl border border-[#f8cad3] text-center">
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
              <span className="absolute left-3.5 text-sm font-bold" style={{ color: "var(--pastel-subtext)" }}>@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="cozy_nomad"
                className="w-full pl-8 pr-4 py-3 rounded-2xl border bg-white focus:outline-none focus:ring-2 text-sm"
                style={{ 
                  borderColor: "var(--pastel-border)", 
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
              className="w-full px-4 py-3 rounded-2xl border bg-white focus:outline-none focus:ring-2 text-sm"
              style={{ 
                borderColor: "var(--pastel-border)", 
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
              className="w-full px-4 py-3 rounded-2xl border bg-white focus:outline-none focus:ring-2 text-sm"
              style={{ 
                borderColor: "var(--pastel-border)", 
                color: "var(--pastel-text)"
              }}
              required
            />
          </div>

          {/* Initial Pastel Theme Choice */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold" style={{ color: "var(--pastel-text)" }}>
                Pick your starter pastel vibe:
              </label>
              <span className="text-[11px] font-bold" style={{ color: "var(--pastel-primary)" }}>
                {PASTEL_THEMES[selectedTheme]?.name}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Object.values(PASTEL_THEMES).map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => handleSelectTheme(th.id)}
                  className={`h-11 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                    selectedTheme === th.id
                      ? "ring-2 scale-105 shadow-xs"
                      : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                  }`}
                  style={{ 
                    backgroundColor: th.tint,
                    borderColor: selectedTheme === th.id ? th.primary : "transparent"
                  }}
                  title={th.name}
                >
                  <span 
                    className="w-4 h-4 rounded-full border shadow-2xs"
                    style={{ backgroundColor: th.primary, borderColor: th.border }}
                  />
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 text-white font-bold rounded-2xl transition-all shadow-sm disabled:opacity-50 text-sm hover:opacity-95 cursor-pointer"
            style={{ backgroundColor: "var(--pastel-primary)" }}
          >
            {loading ? "Creating your cozy account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--pastel-subtext)" }}>
          Already have an account?{" "}
          <Link 
            href="/login" 
            className="font-bold hover:underline"
            style={{ color: "var(--pastel-primary)" }}
          >
            Log in here
          </Link>
        </p>

      </div>
    </div>
  );
}

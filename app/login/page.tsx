"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  PASTEL_THEMES, 
  applyPastelTheme 
} from "@/lib/pastel-themes";
import { useStoredPastelTheme } from "@/lib/usePastelTheme";

export default function Login() {
  const [usernameInput, setUsernameInput] = useState("");
  const [password, setPassword] = useState("");
  const activeTheme = useStoredPastelTheme();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    applyPastelTheme(activeTheme);
  }, [activeTheme]);

  const handleSelectTheme = (themeId: string) => {
    applyPastelTheme(themeId);
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
        // Load user's saved theme if they have one
        try {
          const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
          if (userDoc.exists() && userDoc.data().themeColor) {
            applyPastelTheme(userDoc.data().themeColor);
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
              if (userData.themeColor) {
                applyPastelTheme(userData.themeColor);
              }
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
        className="max-w-md w-full bg-white rounded-3xl p-8 border shadow-sm transition-all"
        style={{ borderColor: "var(--pastel-border)" }}
      >
        
        {/* Header */}
        <div className="text-center mb-6">
          <div 
            className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center font-black text-xl shadow-xs transition-colors"
            style={{ backgroundColor: "var(--pastel-tint)", color: "var(--pastel-primary)" }}
          >
            S
          </div>
          <h1 className="text-2xl font-black" style={{ color: "var(--pastel-text)" }}>
            welcome back ~
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--pastel-subtext)" }}>
            log in to your cozy snapweed space
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs font-semibold text-[#8a223a] bg-[#feebee] rounded-2xl border border-[#f8cad3] text-center">
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
              <span className="absolute left-3.5 text-sm font-bold" style={{ color: "var(--pastel-subtext)" }}>@</span>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="cozy_nomad"
                className="w-full pl-8 pr-4 py-3 rounded-2xl border bg-white focus:outline-none focus:ring-2 text-sm"
                style={{ borderColor: "var(--pastel-border)", color: "var(--pastel-text)" }}
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
              className="w-full px-4 py-3 rounded-2xl border bg-white focus:outline-none focus:ring-2 text-sm"
              style={{ borderColor: "var(--pastel-border)", color: "var(--pastel-text)" }}
              required
            />
          </div>

          {/* Quick pastel theme selector on login */}
          <div className="pt-1">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-bold" style={{ color: "var(--pastel-subtext)" }}>
                Pastel Theme:
              </span>
              <span className="text-[11px] font-bold" style={{ color: "var(--pastel-primary)" }}>
                {PASTEL_THEMES[activeTheme]?.name}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {Object.values(PASTEL_THEMES).map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => handleSelectTheme(th.id)}
                  className={`h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                    activeTheme === th.id
                      ? "ring-2 scale-105 shadow-xs"
                      : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                  }`}
                  style={{
                    backgroundColor: th.tint,
                    borderColor: activeTheme === th.id ? th.primary : "transparent"
                  }}
                  title={th.name}
                >
                  <span 
                    className="w-3.5 h-3.5 rounded-full border shadow-2xs"
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
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--pastel-subtext)" }}>
          New here?{" "}
          <Link 
            href="/signup" 
            className="font-bold hover:underline"
            style={{ color: "var(--pastel-primary)" }}
          >
            Create an account
          </Link>
        </p>

      </div>
    </div>
  );
}

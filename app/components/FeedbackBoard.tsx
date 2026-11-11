"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface SuggestionItem {
  id: string;
  displayName: string;
  suggestion: string;
}

interface FeedbackBoardProps {
  currentName?: string;
  allowCustomName?: boolean;
}

function generateLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

function getStoredLocalSuggestions(): SuggestionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("snapweed_local_suggestions");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function persistLocalSuggestions(items: SuggestionItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("snapweed_local_suggestions", JSON.stringify(items));
  } catch {}
}

export function FeedbackBoard({
  currentName = "",
  allowCustomName = false,
}: FeedbackBoardProps) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusNotice, setStatusNotice] = useState("");

  useEffect(() => {
    const hydrateTimer = setTimeout(() => {
      const stored = getStoredLocalSuggestions();
      if (stored.length > 0) {
        setSuggestions(stored);
      }
    }, 0);

    try {
      const q = query(collection(db, "suggestions"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              displayName: String(data.displayName || "Member"),
              suggestion: String(data.suggestion || ""),
            };
          }) as SuggestionItem[];

          setSuggestions(items);
          persistLocalSuggestions(items);
        },
        (err) => {
          if (err.code === "permission-denied" || err.message?.includes("permissions")) {
            setSuggestions(getStoredLocalSuggestions());
          } else {
            console.warn("Firestore suggestions sync notice:", err.message);
          }
        }
      );

      return () => {
        clearTimeout(hydrateTimer);
        unsubscribe();
      };
    } catch {
      return () => clearTimeout(hydrateTimer);
    }
  }, []);

  const needsNameInput = allowCustomName || !currentName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSuggestion = message.trim();
    const cleanDisplayName = needsNameInput
      ? guestName.trim() || currentName.trim()
      : currentName.trim();

    if (!cleanSuggestion || !cleanDisplayName) return;

    setSubmitting(true);
    setStatusNotice("");

    const localItem: SuggestionItem = {
      id: generateLocalId("sug"),
      displayName: cleanDisplayName,
      suggestion: cleanSuggestion,
    };

    // Optimistic UI update
    setSuggestions((prev) => {
      const next = [localItem, ...prev];
      persistLocalSuggestions(next);
      return next;
    });

    setMessage("");
    if (allowCustomName) {
      setGuestName("");
    }

    try {
      // Strictly store only displayName and suggestion in Firestore
      await addDoc(collection(db, "suggestions"), {
        displayName: cleanDisplayName,
        suggestion: cleanSuggestion,
      });
      setStatusNotice("Thank you! Your suggestion has been shared.");
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === "permission-denied") {
        setStatusNotice("Saved locally. Publish the updated Firestore rules to sync publicly.");
      } else {
        setStatusNotice("Saved locally.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Open Editorial Header */}
      <div className="px-1">
        <h3 className="text-base sm:text-lg font-extrabold text-[var(--pastel-text)] tracking-tight">
          Feedback &amp; Suggestions
        </h3>
        <p className="text-xs text-[var(--pastel-subtext)] mt-0.5">
          Suggest new features, improvements, or changes you want to see &bull; public to everyone
        </p>
      </div>

      {/* Submission Form */}
      <form
        onSubmit={handleSubmit}
        className="p-5 sm:p-6 bg-[var(--pastel-card)] rounded-3xl portfolio-shadow space-y-3.5"
      >
        {needsNameInput ? (
          <div>
            <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1.5">
              Your Display Name *
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your display name"
              maxLength={80}
              className="w-full px-4 py-2.5 rounded-2xl bg-[var(--pastel-input)] text-sm text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
              required
            />
          </div>
        ) : (
          <div className="text-[11px] font-bold text-[var(--pastel-subtext)]">
            Sharing as <span className="text-[var(--pastel-text)]">{currentName}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-[var(--pastel-text)] mb-1.5">
            Feedback or Requested Change *
          </label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share feedback, new features, or changes you want..."
            maxLength={2000}
            className="w-full px-4 py-2.5 rounded-2xl bg-[var(--pastel-input)] text-sm text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
            required
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {statusNotice ? (
            <span className="text-xs font-bold" style={{ color: "var(--pastel-accent-text)" }}>
              {statusNotice}
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={submitting || !message.trim() || (needsNameInput && !guestName.trim())}
            className="px-5 py-2.5 bg-[var(--pastel-primary)] hover:opacity-90 text-[var(--pastel-on-primary)] rounded-full text-xs font-bold transition-all portfolio-shadow disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Submitting..." : "Submit Suggestion"}
          </button>
        </div>
      </form>

      {/* Public Suggestions Feed */}
      <div className="space-y-3.5">
        {suggestions.length === 0 ? (
          <div className="text-center py-10 text-xs text-[var(--pastel-subtext)] bg-[var(--pastel-card)] rounded-3xl portfolio-shadow">
            No suggestions shared yet ~ be the first to suggest a new change!
          </div>
        ) : (
          suggestions.map((item) => (
            <div
              key={item.id}
              className="p-5 bg-[var(--pastel-card)] rounded-3xl portfolio-shadow transition-all space-y-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[var(--pastel-tint)] text-[var(--pastel-accent-text)] font-bold text-[11px] flex items-center justify-center shrink-0">
                  {item.displayName?.charAt(0)?.toUpperCase() || "U"}
                </span>
                <span className="text-xs font-bold text-[var(--pastel-text)]">
                  {item.displayName}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-[var(--pastel-text)] leading-relaxed whitespace-pre-wrap pl-8 opacity-90">
                {item.suggestion}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}


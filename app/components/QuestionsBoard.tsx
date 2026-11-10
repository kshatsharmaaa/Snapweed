"use client";

import { useState, useEffect } from "react";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  doc, 
  updateDoc, 
  arrayUnion, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AnswerItem {
  id: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorPhoto?: string;
  text: string;
  createdAt?: string;
}

export interface QuestionData {
  id: string;
  question: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorPhoto?: string;
  answers: AnswerItem[];
  createdAt?: unknown;
}

interface QuestionsBoardProps {
  currentUid: string;
  currentUsername: string;
  currentName: string;
  currentPhoto?: string;
}

const STARTER_QUESTIONS: QuestionData[] = [
  {
    id: "q_sample_1",
    question: "What is your go-to comfort song when it is raining?",
    authorId: "snapweed_host",
    authorUsername: "maya",
    authorName: "Maya",
    answers: [
      {
        id: "ans_sample_1",
        authorId: "friend_1",
        authorUsername: "leo",
        authorName: "Leo",
        text: "Golden Hour by JVKE or anything gentle with acoustic guitars.",
        createdAt: "10:30 AM",
      },
    ],
  },
  {
    id: "q_sample_2",
    question: "What is a small cozy ritual that made you smile today?",
    authorId: "snapweed_host",
    authorUsername: "clara",
    authorName: "Clara",
    answers: [
      {
        id: "ans_sample_2",
        authorId: "friend_2",
        authorUsername: "sam",
        authorName: "Sam",
        text: "Brewing warm cinnamon tea while reading by the window.",
        createdAt: "11:15 AM",
      },
    ],
  },
];

function getStoredLocalQuestions(): QuestionData[] {
  if (typeof window === "undefined") return STARTER_QUESTIONS;
  try {
    const raw = localStorage.getItem("snapweed_local_questions");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return STARTER_QUESTIONS;
}

function persistLocalQuestions(items: QuestionData[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("snapweed_local_questions", JSON.stringify(items));
  } catch {}
}

function generateLocalId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

export function QuestionsBoard({
  currentUid,
  currentUsername,
  currentName,
  currentPhoto = "",
}: QuestionsBoardProps) {
  const [questions, setQuestions] = useState<QuestionData[]>(() => getStoredLocalQuestions());
  const [newQuestion, setNewQuestion] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    try {
      const q = query(collection(db, "questions"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as QuestionData[];

          items.sort((a, b) => {
            const timeA = (a.createdAt as { toMillis?: () => number })?.toMillis
              ? (a.createdAt as { toMillis: () => number }).toMillis()
              : 0;
            const timeB = (b.createdAt as { toMillis?: () => number })?.toMillis
              ? (b.createdAt as { toMillis: () => number }).toMillis()
              : 0;
            return timeB - timeA;
          });

          if (items.length > 0) {
            setQuestions(items);
            persistLocalQuestions(items);
          }
        },
        (err) => {
          // If Firestore security rules restrict questions collection, fall back silently
          if (err.code === "permission-denied" || err.message?.includes("permissions")) {
            setQuestions(getStoredLocalQuestions());
          } else {
            console.warn("Firestore questions sync notice:", err.message);
          }
        }
      );

      return () => unsubscribe();
    } catch {
      // Keep current local questions
    }
  }, []);

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    setSubmitting(true);
    const newQObj: QuestionData = {
      id: generateLocalId("q"),
      question: newQuestion.trim(),
      authorId: currentUid,
      authorUsername: currentUsername,
      authorName: currentName || currentUsername,
      authorPhoto: currentPhoto || "",
      answers: [],
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "questions"), {
        question: newQuestion.trim(),
        authorId: currentUid,
        authorUsername: currentUsername,
        authorName: currentName || currentUsername,
        authorPhoto: currentPhoto || "",
        answers: [],
        createdAt: serverTimestamp(),
      });
      setNewQuestion("");
      setShowAddForm(false);
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      // Fallback: save locally
      setQuestions((prev) => {
        const updated = [newQObj, ...prev];
        persistLocalQuestions(updated);
        return updated;
      });
      setNewQuestion("");
      setShowAddForm(false);
      if (errObj.code !== "permission-denied") {
        console.warn("Saved question locally:", errObj.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostReply = async (qId: string) => {
    if (!replyText.trim()) return;

    setReplying(true);
    const answer: AnswerItem = {
      id: generateLocalId(`ans_${currentUid}_${qId}`),
      authorId: currentUid,
      authorUsername: currentUsername,
      authorName: currentName || currentUsername,
      authorPhoto: currentPhoto || "",
      text: replyText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };

    try {
      const qRef = doc(db, "questions", qId);
      await updateDoc(qRef, {
        answers: arrayUnion(answer),
        updatedAt: serverTimestamp(),
      });
      setReplyText("");
      setActiveQuestionId(null);
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      // Update locally
      setQuestions((prev) => {
        const updated = prev.map((q) => {
          if (q.id === qId) {
            return { ...q, answers: [...(q.answers || []), answer] };
          }
          return q;
        });
        persistLocalQuestions(updated);
        return updated;
      });
      setReplyText("");
      setActiveQuestionId(null);
      if (errObj.code !== "permission-denied") {
        console.warn("Saved answer locally:", errObj.message);
      }
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[var(--pastel-border)] shadow-xs transition-colors">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h3 className="text-lg font-black text-[var(--pastel-text)] flex items-center gap-2">
            Questions for All
          </h3>
          <p className="text-xs text-[var(--pastel-subtext)]">
            ask the snapweed community anything &bull; answer questions
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3.5 py-1.5 bg-[var(--pastel-tint)] hover:bg-[var(--pastel-border)] text-[var(--pastel-text)] rounded-2xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          {showAddForm ? "Cancel" : "+ Ask Question"}
        </button>
      </div>

      {/* Ask Question Form */}
      {showAddForm && (
        <form onSubmit={handleCreateQuestion} className="mb-6 p-4 bg-[var(--pastel-tint)]/40 rounded-2xl border border-[var(--pastel-border)] space-y-3">
          <label className="block text-xs font-bold text-[var(--pastel-text)]">
            What do you want to ask everyone?
          </label>
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="e.g. What is your go-to comfort song when it's raining?"
            className="w-full px-3.5 py-2.5 rounded-2xl border border-[var(--pastel-border)] bg-white text-sm text-[var(--pastel-text)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)]"
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[var(--pastel-primary)] hover:opacity-90 text-white rounded-2xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Posting..." : "Post Question"}
            </button>
          </div>
        </form>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="text-center py-8 text-xs text-[var(--pastel-subtext)] bg-[var(--pastel-tint)]/25 rounded-2xl border border-[var(--pastel-border)]/60">
            No questions yet ~ be the first to ask!
          </div>
        ) : (
          questions.map((q) => (
            <div
              key={q.id}
              className="p-4 bg-[var(--pastel-tint)]/20 rounded-2xl border border-[var(--pastel-border)]/70 hover:border-[var(--pastel-border)] transition-colors"
            >
              {/* Question Header */}
              <div className="flex justify-between items-start gap-2 mb-2">
                <h4 className="text-sm font-bold text-[var(--pastel-text)] leading-snug">
                  {q.question}
                </h4>
                <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-[var(--pastel-subtext)] font-medium">
                  {q.authorPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.authorPhoto} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-[var(--pastel-tint)] text-[var(--pastel-primary)] font-bold text-[9px] flex items-center justify-center border border-[var(--pastel-border)]">
                      {q.authorName?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  )}
                  <span>@{q.authorUsername}</span>
                </div>
              </div>

              {/* Answers */}
              {q.answers && q.answers.length > 0 && (
                <div className="mt-3 pl-3 border-l-2 border-[var(--pastel-border)] space-y-2">
                  {q.answers.map((ans) => (
                    <div key={ans.id} className="text-xs text-[var(--pastel-text)] flex items-start gap-1.5">
                      {ans.authorPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ans.authorPhoto} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0 mt-0.5" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full bg-[var(--pastel-tint)] text-[var(--pastel-primary)] font-bold text-[8px] flex items-center justify-center border border-[var(--pastel-border)] shrink-0 mt-0.5">
                          {ans.authorName?.charAt(0)?.toUpperCase() || "U"}
                        </span>
                      )}
                      <div>
                        <span className="font-bold text-[var(--pastel-subtext)] mr-1">@{ans.authorUsername}:</span>
                        <span>{ans.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Button or Input */}
              {activeQuestionId === q.id ? (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your answer..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-[var(--pastel-border)] bg-white text-[var(--pastel-text)] focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => handlePostReply(q.id)}
                    disabled={replying || !replyText.trim()}
                    className="px-3 py-1.5 bg-[var(--pastel-primary)] hover:opacity-90 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => {
                      setActiveQuestionId(null);
                      setReplyText("");
                    }}
                    className="px-2 text-xs text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveQuestionId(q.id)}
                  className="mt-2 text-[11px] font-bold text-[var(--pastel-primary)] hover:underline"
                >
                  + Add Answer
                </button>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
}

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
import { useUserPhotoDirectory, resolveAuthorPhoto } from "@/lib/user-avatars";
import { UserAvatar } from "./UserAvatar";

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
        text: "Golden Hour by JVKE or anything with acoustic guitars.",
        createdAt: "10:30 AM",
      },
    ],
  },
  {
    id: "q_sample_2",
    question: "What is one daily habit you actually look forward to?",
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
  const photoDir = useUserPhotoDirectory();

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
    <div className="space-y-5">
      
      {/* Open Editorial Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 px-1">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-[var(--pastel-text)] tracking-tight">
            Questions for All
          </h3>
          <p className="text-xs text-[var(--pastel-subtext)] mt-0.5">
            Ask the snapweed community anything &bull; answer questions
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all portfolio-shadow cursor-pointer ${
            showAddForm
              ? "bg-[var(--pastel-card)] text-[var(--pastel-text)]"
              : "bg-[var(--pastel-primary)] text-[var(--pastel-on-primary)] hover:opacity-90"
          }`}
        >
          {showAddForm ? "Cancel" : "+ Ask Question"}
        </button>
      </div>

      {/* Ask Question Form */}
      {showAddForm && (
        <form onSubmit={handleCreateQuestion} className="p-5 sm:p-6 bg-[var(--pastel-card)] rounded-3xl portfolio-shadow space-y-3">
          <label className="block text-xs font-bold text-[var(--pastel-text)]">
            What do you want to ask everyone?
          </label>
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="e.g. What is your go-to comfort song when it's raining?"
            className="w-full px-4 py-2.5 rounded-2xl bg-[var(--pastel-input)] text-sm text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[var(--pastel-primary)] hover:opacity-90 text-[var(--pastel-on-primary)] rounded-full text-xs font-bold transition-all portfolio-shadow disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Posting..." : "Post Question"}
            </button>
          </div>
        </form>
      )}

      {/* Questions List — Borderless Elevated Cards */}
      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="text-center py-10 text-xs text-[var(--pastel-subtext)] bg-[var(--pastel-card)] rounded-3xl portfolio-shadow">
            No questions yet ~ be the first to ask!
          </div>
        ) : (
          questions.map((q) => {
            const qPhoto = resolveAuthorPhoto(photoDir, {
              authorId: q.authorId,
              authorPhoto: q.authorPhoto,
              authorName: q.authorName,
              authorUsername: q.authorUsername,
              currentUid,
              currentPhoto,
              currentName,
              currentUsername,
            });
            return (
              <div
                key={q.id}
                className="p-5 sm:p-6 bg-[var(--pastel-card)] rounded-3xl portfolio-shadow transition-all"
              >
                {/* Question Header */}
                <div className="flex justify-between items-start gap-3 mb-2">
                  <h4 className="text-sm sm:text-base font-bold text-[var(--pastel-text)] leading-snug">
                    {q.question}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-[var(--pastel-tint)] text-[11px] text-[var(--pastel-text)] font-semibold">
                    <UserAvatar
                      name={q.authorName || q.authorUsername}
                      photoUrl={qPhoto}
                      sizeClass="w-5 h-5"
                      textClass="text-[10px]"
                      bgClass="bg-[var(--pastel-card)]"
                    />
                    <span>@{q.authorUsername}</span>
                  </div>
                </div>

                {/* Answers */}
                {q.answers && q.answers.length > 0 && (
                  <div
                    className="mt-3 pl-3.5 space-y-2"
                    style={{ borderLeft: "2px solid var(--pastel-primary)" }}
                  >
                    {q.answers.map((ans) => {
                      const ansPhoto = resolveAuthorPhoto(photoDir, {
                        authorId: ans.authorId,
                        authorPhoto: ans.authorPhoto,
                        authorName: ans.authorName,
                        authorUsername: ans.authorUsername,
                        currentUid,
                        currentPhoto,
                        currentName,
                        currentUsername,
                      });
                      return (
                        <div key={ans.id} className="text-xs text-[var(--pastel-text)] flex items-start gap-2">
                          <UserAvatar
                            name={ans.authorName || ans.authorUsername}
                            photoUrl={ansPhoto}
                            sizeClass="w-5 h-5"
                            textClass="text-[9px]"
                            bgClass="bg-[var(--pastel-tint)]"
                            className="mt-0.5"
                          />
                          <div>
                            <span className="font-bold text-[var(--pastel-subtext)] mr-1.5">@{ans.authorUsername}:</span>
                            <span>{ans.text}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply Button or Input */}
                {activeQuestionId === q.id ? (
                  <div className="mt-3.5 flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your answer..."
                      className="flex-1 px-4 py-2 text-xs rounded-full bg-[var(--pastel-input)] text-[var(--pastel-text)] placeholder-[var(--pastel-subtext)] focus:outline-none focus:ring-2 focus:ring-[var(--pastel-primary)]"
                      autoFocus
                    />
                    <button
                      onClick={() => handlePostReply(q.id)}
                      disabled={replying || !replyText.trim()}
                      className="px-4 py-2 bg-[var(--pastel-primary)] hover:opacity-90 text-[var(--pastel-on-primary)] text-xs font-bold rounded-full transition-all disabled:opacity-50 cursor-pointer"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => {
                        setActiveQuestionId(null);
                        setReplyText("");
                      }}
                      className="px-2.5 text-xs text-[var(--pastel-subtext)] hover:text-[var(--pastel-text)] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveQuestionId(q.id)}
                    className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-[var(--pastel-tint)] text-[11px] font-bold hover:opacity-85 transition-opacity cursor-pointer"
                    style={{ color: "var(--pastel-accent-text)" }}
                  >
                    + Add Answer
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}

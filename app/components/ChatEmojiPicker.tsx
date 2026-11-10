"use client";

import { useState, useRef, useEffect } from "react";

const EMOJI_CATEGORIES: { id: string; label: string; emojis: string[] }[] = [
  {
    id: "smileys",
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊",
      "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😋",
      "😛", "😜", "🤪", "🤗", "🤭", "🤔", "🥺", "🥹",
      "😭", "😤", "😴", "😎", "🥳", "🤩", "🫠", "🤯",
    ],
  },
  {
    id: "reactions",
    label: "Reactions",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "💖",
      "💕", "✨", "🔥", "💯", "👏", "🙌", "👍", "👎",
      "🫶", "🤝", "✌️", "🤞", "🙏", "💪", "🎉", "🎊",
    ],
  },
  {
    id: "cozy",
    label: "Cozy",
    emojis: [
      "☕", "🍵", "🧋", "🥐", "🍰", "🍪", "🍓", "🍑",
      "🌸", "🌷", "🌿", "🍃", "🌙", "⭐", "☀️", "☁️",
      "🌧️", "🌈", "🎧", "🎵", "🎶", "📖", "🕯️", "🧸",
    ],
  },
  {
    id: "fun",
    label: "Fun",
    emojis: [
      "👀", "💀", "🤡", "👻", "👾", "🎮", "🎬", "📸",
      "🪩", "🦋", "🐣", "🐱", "🐶", "🦊", "🚀", "🎁",
    ],
  },
];

interface ChatEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
}

export function ChatEmojiPicker({ onSelectEmoji }: ChatEmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("smileys");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const currentGroup =
    EMOJI_CATEGORIES.find((c) => c.id === activeCategory) || EMOJI_CATEGORIES[0];

  return (
    <div className="relative" ref={containerRef} style={{ colorScheme: "light" }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2.5 rounded-full border transition-all shadow-2xs hover:opacity-85 cursor-pointer flex items-center justify-center shrink-0"
        style={{
          backgroundColor: isOpen ? "var(--pastel-border)" : "var(--pastel-tint)",
          borderColor: "var(--pastel-border)",
          color: "var(--pastel-text)",
        }}
        title="Emoji keyboard"
        aria-label="Open emoji keyboard"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2.5 w-72 sm:w-80 bg-white rounded-3xl border shadow-xl z-50 overflow-hidden"
          style={{ borderColor: "var(--pastel-border)", colorScheme: "light" }}
        >
          {/* Category Tabs */}
          <div
            className="px-2.5 py-2 border-b flex gap-1 overflow-x-auto"
            style={{
              backgroundColor: "var(--pastel-tint)",
              borderColor: "var(--pastel-border)",
            }}
          >
            {EMOJI_CATEGORIES.map((cat) => {
              const active = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer shrink-0"
                  style={{
                    backgroundColor: active ? "var(--pastel-primary)" : "#ffffff",
                    color: active ? "#ffffff" : "var(--pastel-subtext)",
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Emoji Grid */}
          <div className="p-2.5 grid grid-cols-8 gap-1 max-h-52 overflow-y-auto bg-white">
            {currentGroup.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelectEmoji(emoji)}
                className="w-8 h-8 rounded-xl text-lg flex items-center justify-center hover:scale-110 transition-transform cursor-pointer hover:bg-stone-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


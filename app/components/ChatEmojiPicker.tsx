"use client";

import { useState, useRef, useEffect } from "react";
import { EmojiPicker } from "frimousse";

const RECENT_EMOJIS_KEY = "snapweed_recent_emojis";
const APPLE_EMOJI_FONT =
  "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

function getStoredRecentEmojis(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_EMOJIS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 7);
    }
  } catch {}
  return [];
}

function saveRecentEmoji(emoji: string, current: string[]): string[] {
  const next = [emoji, ...current.filter((e) => e !== emoji)].slice(0, 7);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(next));
    } catch {}
  }
  return next;
}

interface ChatEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
}

export function ChatEmojiPicker({ onSelectEmoji }: ChatEmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setRecentEmojis(getStoredRecentEmojis());
    }, 0);
    return () => clearTimeout(t);
  }, []);

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

  const handlePick = (emojiChar: string) => {
    setRecentEmojis((prev) => saveRecentEmoji(emojiChar, prev));
    onSelectEmoji(emojiChar);
  };

  return (
    <div className="relative" ref={containerRef} style={{ colorScheme: "light" }}>
      {/* Clean Trigger Button */}
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
        aria-label="Open Apple-styled emoji keyboard"
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

      {/* Apple macOS / iOS Styled Full Emoji Keyboard Popover */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-3 rounded-[22px] bg-white/95 backdrop-blur-2xl border shadow-[0_20px_55px_rgba(0,0,0,0.16)] z-50 overflow-hidden flex flex-col"
          style={{
            width: "360px",
            maxWidth: "calc(100vw - 24px)",
            height: "430px",
            maxHeight: "calc(100vh - 120px)",
            borderColor: "var(--pastel-border)",
            colorScheme: "light",
          }}
        >
          <EmojiPicker.Root
            columns={7}
            sticky
            onEmojiSelect={(emoji) => handlePick(emoji.emoji)}
            className="select-none"
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              width: "100%",
              minHeight: 0,
            }}
          >
            {/* Apple Top Search Row + Skin Tone Switcher */}
            <div className="px-3 pt-3 pb-2 border-b border-stone-200/70 bg-stone-50/80 space-y-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="absolute left-3 text-stone-400 pointer-events-none"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <EmojiPicker.Search
                    placeholder="Search Emoji"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-200/65 text-xs font-medium text-stone-800 placeholder-stone-400 outline-none focus:bg-white focus:ring-2 focus:ring-[var(--pastel-primary)] transition-all"
                  />
                </div>

                <EmojiPicker.SkinToneSelector
                  aria-label="Select skin tone"
                  title="Change skin tone"
                  className="size-9 rounded-xl bg-stone-200/65 hover:bg-stone-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  style={{ fontSize: "22px", lineHeight: 1, fontFamily: APPLE_EMOJI_FONT }}
                />
              </div>

              {/* Frequently Used Quick Row */}
              {recentEmojis.length > 0 && (
                <div className="pt-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-1 mb-1">
                    Frequently Used
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {recentEmojis.map((emojiChar) => (
                      <button
                        key={`recent_${emojiChar}`}
                        type="button"
                        onClick={() => handlePick(emojiChar)}
                        className="flex items-center justify-center rounded-xl hover:bg-[var(--pastel-tint)] hover:scale-110 active:scale-95 transition-all cursor-pointer"
                        style={{
                          height: "42px",
                          fontSize: "28px",
                          lineHeight: 1,
                          fontFamily: APPLE_EMOJI_FONT,
                        }}
                      >
                        {emojiChar}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Virtualized Full Unicode Emoji Grid */}
            <EmojiPicker.Viewport
              className="px-1.5 pb-2"
              style={{
                position: "relative",
                flex: "1 1 0%",
                minHeight: 0,
                overflowY: "auto",
              }}
            >
              <EmojiPicker.Loading className="flex h-full items-center justify-center text-xs font-semibold text-stone-400">
                Loading Apple Emoji Keyboard...
              </EmojiPicker.Loading>

              <EmojiPicker.Empty className="flex h-full items-center justify-center text-xs font-semibold text-stone-400">
                {({ search }) => `No emojis matching "${search}"`}
              </EmojiPicker.Empty>

              <EmojiPicker.List
                components={{
                  CategoryHeader: ({ category, ...props }) => (
                    <div
                      {...props}
                      className="bg-white/95 backdrop-blur-md px-2 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-stone-400"
                    >
                      {category.label}
                    </div>
                  ),
                  Row: ({ children, ...props }) => (
                    <div
                      {...props}
                      className="w-full justify-between px-0.5"
                    >
                      {children}
                    </div>
                  ),
                  Emoji: ({ emoji, ...props }) => (
                    <button
                      {...props}
                      type="button"
                      className="flex items-center justify-center rounded-xl transition-transform duration-75 cursor-pointer hover:scale-110 active:scale-95 data-[active]:bg-[var(--pastel-tint)]"
                      style={{
                        ...props.style,
                        width: "44px",
                        height: "44px",
                        fontSize: "29px",
                        lineHeight: 1,
                        fontFamily: APPLE_EMOJI_FONT,
                      }}
                    >
                      {emoji.emoji}
                    </button>
                  ),
                }}
              />
            </EmojiPicker.Viewport>

            {/* macOS Character-Viewer Style Hover Preview Footer */}
            <div className="px-3.5 py-2 border-t border-stone-200/70 bg-stone-50/90 flex items-center gap-3 shrink-0" style={{ minHeight: "46px" }}>
              <EmojiPicker.ActiveEmoji>
                {({ emoji }) =>
                  emoji ? (
                    <>
                      <span
                        className="shrink-0"
                        style={{
                          fontSize: "28px",
                          lineHeight: 1,
                          fontFamily: APPLE_EMOJI_FONT,
                        }}
                      >
                        {emoji.emoji}
                      </span>
                      <span className="text-xs font-semibold text-stone-600 capitalize truncate">
                        {emoji.label}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-stone-400">
                      Select an emoji...
                    </span>
                  )
                }
              </EmojiPicker.ActiveEmoji>
            </div>
          </EmojiPicker.Root>
        </div>
      )}
    </div>
  );
}

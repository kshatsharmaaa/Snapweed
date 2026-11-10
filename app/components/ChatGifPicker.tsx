"use client";

import { useState, useEffect, useRef } from "react";

export interface SelectedGif {
  url: string;
  title: string;
}

interface GifOption {
  id: string;
  url: string;
  title: string;
}

const GIF_CATEGORIES: { id: string; label: string }[] = [
  { id: "wave", label: "Wave" },
  { id: "happy", label: "Happy" },
  { id: "laugh", label: "Laugh" },
  { id: "dance", label: "Dance" },
  { id: "clap", label: "Clap" },
  { id: "thumbsup", label: "Thumbs Up" },
  { id: "hug", label: "Hug" },
  { id: "highfive", label: "High Five" },
  { id: "sip", label: "Sip" },
  { id: "wink", label: "Wink" },
  { id: "shrug", label: "Shrug" },
  { id: "blush", label: "Blush" },
];

interface ChatGifPickerProps {
  onSelectGif: (gif: SelectedGif) => void;
}

export function ChatGifPicker({ onSelectGif }: ChatGifPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("wave");
  const [gifs, setGifs] = useState<GifOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
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

  const trimmedQuery = query.trim();
  const isCustomGifUrl =
    (trimmedQuery.startsWith("http://") || trimmedQuery.startsWith("https://")) &&
    trimmedQuery.length > 10;

  // Fetch GIFs when open or search/category changes
  useEffect(() => {
    if (!isOpen || isCustomGifUrl) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!cancelled) setLoading(true);
      try {
        const params = trimmedQuery
          ? `q=${encodeURIComponent(trimmedQuery)}`
          : `category=${encodeURIComponent(activeCategory)}`;
        const res = await fetch(`/api/gifs?${params}`);
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { gifs?: GifOption[] };
          setGifs(Array.isArray(data.gifs) ? data.gifs : []);
        }
      } catch {
        if (!cancelled) setGifs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, trimmedQuery ? 350 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, trimmedQuery, activeCategory, isCustomGifUrl]);

  const handleChoose = (gif: SelectedGif) => {
    onSelectGif(gif);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-2.5 py-2 rounded-full border text-[11px] font-black tracking-tight transition-all shadow-2xs hover:opacity-85 cursor-pointer flex items-center justify-center shrink-0"
        style={{
          backgroundColor: isOpen ? "var(--pastel-border)" : "var(--pastel-tint)",
          borderColor: "var(--pastel-border)",
          color: "var(--pastel-text)",
        }}
        title="Send a GIF"
        aria-label="Open GIF picker"
      >
        GIF
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2.5 w-80 sm:w-96 bg-[var(--pastel-card)] rounded-3xl border shadow-xl z-50 overflow-hidden"
          style={{ borderColor: "var(--pastel-border)" }}
        >
          {/* Search Input */}
          <div
            className="p-2.5 border-b space-y-2"
            style={{
              backgroundColor: "var(--pastel-tint)",
              borderColor: "var(--pastel-border)",
            }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search GIFs or paste a .gif URL..."
              className="w-full px-3 py-1.5 rounded-xl border bg-[var(--pastel-card)] text-xs focus:outline-none focus:ring-2"
              style={{
                borderColor: "var(--pastel-border)",
                color: "var(--pastel-text)",
              }}
            />

            {/* Category Chips */}
            {!isCustomGifUrl && (
              <div className="flex gap-1 overflow-x-auto pb-0.5">
                {GIF_CATEGORIES.map((cat) => {
                  const active = !trimmedQuery && activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setActiveCategory(cat.id);
                      }}
                      className="px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer shrink-0"
                      style={{
                        backgroundColor: active ? "var(--pastel-primary)" : "var(--pastel-card)",
                        color: active ? "#ffffff" : "var(--pastel-subtext)",
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom GIF URL Sender OR Reaction Grid */}
          <div className="p-2.5 max-h-64 overflow-y-auto bg-[var(--pastel-card)]">
            {isCustomGifUrl ? (
              <div className="space-y-2 text-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={trimmedQuery}
                  alt="Custom GIF preview"
                  className="max-h-40 mx-auto rounded-2xl object-contain border"
                  style={{ borderColor: "var(--pastel-border)" }}
                />
                <button
                  type="button"
                  onClick={() =>
                    handleChoose({ url: trimmedQuery, title: "Shared GIF" })
                  }
                  className="w-full py-2 rounded-2xl text-xs font-bold text-white shadow-xs cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: "var(--pastel-primary)" }}
                >
                  Send GIF
                </button>
              </div>
            ) : loading ? (
              <div className="py-10 text-center text-xs font-semibold" style={{ color: "var(--pastel-subtext)" }}>
                Loading GIFs...
              </div>
            ) : gifs.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-1">
                <p className="text-xs font-bold" style={{ color: "var(--pastel-text)" }}>
                  No GIFs found
                </p>
                <p className="text-[11px]" style={{ color: "var(--pastel-subtext)" }}>
                  Try another reaction chip or paste any direct .gif link above.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleChoose({ url: g.url, title: g.title })}
                    className="group relative rounded-2xl overflow-hidden border hover:opacity-95 transition-all cursor-pointer bg-[var(--pastel-tint)]"
                    style={{ borderColor: "var(--pastel-border)" }}
                    title={`Send ${g.title} GIF`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.url}
                      alt={g.title}
                      loading="lazy"
                      className="w-full h-24 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


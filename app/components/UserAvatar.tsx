"use client";

import { useState } from "react";

interface UserAvatarProps {
  name?: string;
  photoUrl?: string;
  sizeClass?: string;
  textClass?: string;
  bgClass?: string;
  className?: string;
}

/** Circular user avatar showing profile photo when available, falling back cleanly to initial letter. */
export function UserAvatar({
  name = "User",
  photoUrl = "",
  sizeClass = "w-5 h-5",
  textClass = "text-[10px]",
  bgClass = "bg-[var(--pastel-card)]",
  className = "",
}: UserAvatarProps) {
  const [failedSrc, setFailedSrc] = useState("");
  const cleanSrc = (photoUrl || "").trim();
  const initial = (name || "U").trim().charAt(0).toUpperCase() || "U";

  if (cleanSrc && failedSrc !== cleanSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cleanSrc}
        alt={name || "User profile photo"}
        onError={() => setFailedSrc(cleanSrc)}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} ${bgClass} rounded-full font-bold ${textClass} flex items-center justify-center shrink-0 ${className}`}
      style={{ color: "var(--pastel-accent-text)" }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}


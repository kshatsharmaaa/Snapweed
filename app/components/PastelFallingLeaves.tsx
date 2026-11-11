"use client";

import { FallingLeaves, LeafShape } from "falling-leaves/react";
import { useStoredPastelTheme, useStoredThemeMode } from "@/lib/usePastelTheme";
import { DEFAULT_THEME_ID } from "@/lib/pastel-themes";

const THEME_LEAF_COLORS: Record<string, string[]> = {
  blush: ["#e5a1aa", "#f0bec4", "#7AD0AC", "#8395CD"],
  matcha: ["#7AD0AC", "#a8e3ca", "#e5a1aa", "#8395CD"],
  sky: ["#8395CD", "#adb9e3", "#e5a1aa", "#7AD0AC"],
  lavender: ["#B5A3E3", "#cfc3f0", "#e5a1aa", "#7AD0AC"],
  peach: ["#EFA98B", "#f7c7b2", "#e5a1aa", "#7AD0AC"],
  butter: ["#E8CE74", "#f3e2a2", "#e5a1aa", "#7AD0AC"],
};

const DARK_LEAF_COLORS = ["#FAF4E5", "#e8dbba", "#f5dfe3", "#d8f2e6"];

const LEAF_SHAPES: LeafShape[] = ["maple", "ginkgo", "birch", "oval"];

export function PastelFallingLeaves() {
  const themeId = useStoredPastelTheme();
  const themeMode = useStoredThemeMode();
  const colors =
    themeMode === "dark"
      ? DARK_LEAF_COLORS
      : THEME_LEAF_COLORS[themeId] || THEME_LEAF_COLORS[DEFAULT_THEME_ID];

  return (
    <FallingLeaves
      fullScreen
      count={20}
      size={[12, 22]}
      speed={[0.45, 1.05]}
      wind={[-0.25, 0.55]}
      sway={[0.4, 1.2]}
      rotationSpeed={[-1.2, 1.2]}
      shapes={LEAF_SHAPES}
      colors={colors}
      opacity={themeMode === "dark" ? 0.34 : 0.5}
      zIndex={25}
      respectReducedMotion
    />
  );
}

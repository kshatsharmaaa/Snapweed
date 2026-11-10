"use client";

import { FallingLeaves, LeafShape } from "falling-leaves/react";
import { useStoredPastelTheme, useStoredThemeMode } from "@/lib/usePastelTheme";
import { DEFAULT_THEME_ID } from "@/lib/pastel-themes";

const THEME_LEAF_COLORS: Record<string, string[]> = {
  blush: ["#f5aebc", "#e48394", "#f8cad3", "#d87080"],
  matcha: ["#9fd8af", "#74b887", "#bce6c7", "#5aa471"],
  lavender: ["#c4b0e8", "#a38bd9", "#d4c7ee", "#8972c4"],
  peach: ["#f5b08e", "#ea8f63", "#fad0bc", "#dc723e"],
  sky: ["#9cc5ee", "#72a8e2", "#bcdbf6", "#5a97d6"],
  butter: ["#f5dc78", "#e5c14d", "#fae696", "#cfa932"],
};

const LEAF_SHAPES: LeafShape[] = ["maple", "ginkgo", "birch", "oval"];

export function PastelFallingLeaves() {
  const themeId = useStoredPastelTheme();
  const themeMode = useStoredThemeMode();
  const colors = THEME_LEAF_COLORS[themeId] || THEME_LEAF_COLORS[DEFAULT_THEME_ID];

  return (
    <FallingLeaves
      fullScreen
      count={22}
      size={[12, 22]}
      speed={[0.45, 1.05]}
      wind={[-0.25, 0.55]}
      sway={[0.4, 1.2]}
      rotationSpeed={[-1.2, 1.2]}
      shapes={LEAF_SHAPES}
      colors={colors}
      opacity={themeMode === "dark" ? 0.36 : 0.55}
      zIndex={25}
      respectReducedMotion
    />
  );
}


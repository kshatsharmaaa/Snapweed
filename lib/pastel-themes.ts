export type ThemeMode = "light" | "dark";

export const DEFAULT_THEME_ID = "blush";
export const DEFAULT_THEME_MODE: ThemeMode = "light";

export interface PastelTheme {
  id: string;
  name: string;
  primary: string;
  bg: string;
  card: string;
  tint: string;
  border: string;
  text: string;
  subtext: string;
  navBg: string;
}

export const PASTEL_THEMES: Record<string, PastelTheme> = {
  blush: {
    id: "blush",
    name: "Blush Rose",
    primary: "#d87080",
    bg: "#fff6f8",
    card: "#ffffff",
    tint: "#fde8ec",
    border: "#f8cad3",
    text: "#4f202b",
    subtext: "#9e5c6b",
    navBg: "rgba(255, 255, 255, 0.9)",
  },
  matcha: {
    id: "matcha",
    name: "Matcha Mint",
    primary: "#4d9363",
    bg: "#f2f9f4",
    card: "#ffffff",
    tint: "#e1f5e7",
    border: "#bce6c7",
    text: "#194023",
    subtext: "#4a7554",
    navBg: "rgba(255, 255, 255, 0.9)",
  },
  lavender: {
    id: "lavender",
    name: "Soft Lavender",
    primary: "#765eb5",
    bg: "#f7f4fd",
    card: "#ffffff",
    tint: "#ede6f9",
    border: "#d4c7ee",
    text: "#322355",
    subtext: "#66528e",
    navBg: "rgba(255, 255, 255, 0.9)",
  },
  peach: {
    id: "peach",
    name: "Sweet Peach",
    primary: "#dc723e",
    bg: "#fff7f2",
    card: "#ffffff",
    tint: "#ffebde",
    border: "#fad0bc",
    text: "#4e210d",
    subtext: "#8b5236",
    navBg: "rgba(255, 255, 255, 0.9)",
  },
  sky: {
    id: "sky",
    name: "Baby Blue",
    primary: "#4385ce",
    bg: "#f1f7fd",
    card: "#ffffff",
    tint: "#e0eefc",
    border: "#bcdbf6",
    text: "#18385d",
    subtext: "#4f7095",
    navBg: "rgba(255, 255, 255, 0.9)",
  },
  butter: {
    id: "butter",
    name: "Buttercream",
    primary: "#b8971f",
    bg: "#fffdf2",
    card: "#ffffff",
    tint: "#fff6cf",
    border: "#fae696",
    text: "#47390a",
    subtext: "#7a672f",
    navBg: "rgba(255, 255, 255, 0.9)",
  },
};

export const DARK_PASTEL_THEMES: Record<string, PastelTheme> = {
  blush: {
    id: "blush",
    name: "Blush Rose",
    primary: "#da6e80",
    bg: "#150c10",
    card: "#211319",
    tint: "#2f1b24",
    border: "#4d2937",
    text: "#fcebef",
    subtext: "#cfa2ad",
    navBg: "rgba(33, 19, 25, 0.92)",
  },
  matcha: {
    id: "matcha",
    name: "Matcha Mint",
    primary: "#4d9964",
    bg: "#0d1710",
    card: "#142319",
    tint: "#1d3124",
    border: "#2e4d39",
    text: "#eaf7ee",
    subtext: "#9ac4a7",
    navBg: "rgba(20, 35, 25, 0.92)",
  },
  lavender: {
    id: "lavender",
    name: "Soft Lavender",
    primary: "#846ac9",
    bg: "#120f1c",
    card: "#1c172b",
    tint: "#27203b",
    border: "#403561",
    text: "#f2eeff",
    subtext: "#b8add9",
    navBg: "rgba(28, 23, 43, 0.92)",
  },
  peach: {
    id: "peach",
    name: "Sweet Peach",
    primary: "#df7340",
    bg: "#180f0b",
    card: "#251812",
    tint: "#332018",
    border: "#543426",
    text: "#fff0e8",
    subtext: "#d6a791",
    navBg: "rgba(37, 24, 18, 0.92)",
  },
  sky: {
    id: "sky",
    name: "Baby Blue",
    primary: "#4a8ed8",
    bg: "#0c131d",
    card: "#131e2d",
    tint: "#1b2b40",
    border: "#2c4566",
    text: "#ebf4ff",
    subtext: "#9dbbe0",
    navBg: "rgba(19, 30, 45, 0.92)",
  },
  butter: {
    id: "butter",
    name: "Buttercream",
    primary: "#bfa026",
    bg: "#161309",
    card: "#221d0f",
    tint: "#302916",
    border: "#4f4324",
    text: "#fdf7e2",
    subtext: "#cfc08e",
    navBg: "rgba(34, 29, 15, 0.92)",
  },
};

export function getPastelPalette(themeId: string, mode: ThemeMode = DEFAULT_THEME_MODE): PastelTheme {
  const source = mode === "dark" ? DARK_PASTEL_THEMES : PASTEL_THEMES;
  return source[themeId] || source[DEFAULT_THEME_ID];
}

export function getStoredPastelTheme(): string {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    const saved = localStorage.getItem("snapweed_theme");
    if (saved && PASTEL_THEMES[saved]) return saved;
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_THEME_ID;
}

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_THEME_MODE;
  try {
    const saved = localStorage.getItem("snapweed_theme_mode");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_THEME_MODE;
}

export function applyPastelTheme(themeId: string, mode?: ThemeMode) {
  if (typeof document === "undefined") return;
  const activeMode: ThemeMode = mode || getStoredThemeMode();
  const theme = getPastelPalette(themeId, activeMode);
  const root = document.documentElement;

  // Set data-theme and data-mode on html and body for immediate CSS rule match
  root.setAttribute("data-theme", theme.id);
  root.setAttribute("data-mode", activeMode);
  if (document.body) {
    document.body.setAttribute("data-theme", theme.id);
    document.body.setAttribute("data-mode", activeMode);
  }

  // Set explicit style variables matching chosen theme + light/dark mode
  const props = {
    "--pastel-primary": theme.primary,
    "--pastel-bg": theme.bg,
    "--pastel-card": theme.card,
    "--pastel-tint": theme.tint,
    "--pastel-border": theme.border,
    "--pastel-text": theme.text,
    "--pastel-subtext": theme.subtext,
    "--pastel-nav": theme.navBg,
  };

  Object.entries(props).forEach(([key, val]) => {
    root.style.setProperty(key, val);
    if (document.body) {
      document.body.style.setProperty(key, val);
    }
  });

  if (document.body) {
    document.body.style.backgroundColor = theme.bg;
    document.body.style.color = theme.text;
    document.body.style.colorScheme = activeMode;
  }
  root.style.colorScheme = activeMode;

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("snapweed_theme", theme.id);
      localStorage.setItem("snapweed_theme_mode", activeMode);
      window.dispatchEvent(
        new CustomEvent("snapweed-theme-change", {
          detail: { themeId: theme.id, mode: activeMode },
        })
      );
    } catch {
      // Ignore storage errors
    }
  }
}

export function applyThemeMode(mode: ThemeMode) {
  applyPastelTheme(getStoredPastelTheme(), mode);
}

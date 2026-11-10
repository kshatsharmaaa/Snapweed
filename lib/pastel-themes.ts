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
  },
};

export const DEFAULT_THEME_ID = "blush";

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

export function applyPastelTheme(themeId: string) {
  if (typeof document === "undefined") return;
  const theme = PASTEL_THEMES[themeId] || PASTEL_THEMES[DEFAULT_THEME_ID];
  const root = document.documentElement;

  // Set data-theme on html and body for immediate CSS rule match
  root.setAttribute("data-theme", theme.id);
  if (document.body) {
    document.body.setAttribute("data-theme", theme.id);
  }

  // Set explicit style variables
  const props = {
    "--pastel-primary": theme.primary,
    "--pastel-bg": theme.bg,
    "--pastel-card": theme.card,
    "--pastel-tint": theme.tint,
    "--pastel-border": theme.border,
    "--pastel-text": theme.text,
    "--pastel-subtext": theme.subtext,
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
    document.body.style.colorScheme = "light";
  }
  root.style.colorScheme = "light";

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("snapweed_theme", theme.id);
      window.dispatchEvent(new CustomEvent("snapweed-theme-change", { detail: theme.id }));
    } catch {
      // Ignore storage errors
    }
  }
}

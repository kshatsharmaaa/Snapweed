export type ThemeMode = "light" | "dark";

export const DEFAULT_THEME_ID = "blush";
export const DEFAULT_THEME_MODE: ThemeMode = "light";

export interface PastelTheme {
  id: string;
  name: string;
  shortName: string;
  primary: string;
  onPrimary: string;
  accentText: string;
  bg: string;
  card: string;
  input: string;
  tint: string;
  border: string;
  text: string;
  subtext: string;
  navBg: string;
}

/* Light mode: warm #FAF4E5 cream parchment & #333332 charcoal ink from ashkatts-portfolio.vercel.app with borderless elevated ivory cards */
export const PASTEL_THEMES: Record<string, PastelTheme> = {
  blush: {
    id: "blush",
    name: "Blush Pink",
    shortName: "Blush",
    primary: "#e5a1aa",
    onPrimary: "#2b2022",
    accentText: "#b55a67",
    bg: "#FAF4E5",
    card: "#FFFDF8",
    input: "#F3EAE1",
    tint: "#F4E5E2",
    border: "rgba(229, 161, 170, 0.24)",
    text: "#333332",
    subtext: "#756d67",
    navBg: "rgba(250, 244, 229, 0.88)",
  },
  matcha: {
    id: "matcha",
    name: "Sage Mint",
    shortName: "Mint",
    primary: "#7AD0AC",
    onPrimary: "#1b2b24",
    accentText: "#2c7557",
    bg: "#FAF4E5",
    card: "#FFFDF8",
    input: "#EFF1E6",
    tint: "#E3F2EA",
    border: "rgba(122, 208, 172, 0.26)",
    text: "#333332",
    subtext: "#617068",
    navBg: "rgba(250, 244, 229, 0.88)",
  },
  sky: {
    id: "sky",
    name: "Periwinkle",
    shortName: "Periwinkle",
    primary: "#8395CD",
    onPrimary: "#1b2033",
    accentText: "#4d5f9c",
    bg: "#FAF4E5",
    card: "#FFFDF8",
    input: "#EEECE6",
    tint: "#E6E9F4",
    border: "rgba(131, 149, 205, 0.26)",
    text: "#333332",
    subtext: "#636978",
    navBg: "rgba(250, 244, 229, 0.88)",
  },
  lavender: {
    id: "lavender",
    name: "Soft Lavender",
    shortName: "Lavender",
    primary: "#B5A3E3",
    onPrimary: "#241e36",
    accentText: "#66529c",
    bg: "#FAF4E5",
    card: "#FFFDF8",
    input: "#F0ECEA",
    tint: "#EDE8F6",
    border: "rgba(181, 163, 227, 0.26)",
    text: "#333332",
    subtext: "#6c6678",
    navBg: "rgba(250, 244, 229, 0.88)",
  },
  peach: {
    id: "peach",
    name: "Warm Peach",
    shortName: "Peach",
    primary: "#EFA98B",
    onPrimary: "#2e1f19",
    accentText: "#ad5a39",
    bg: "#FAF4E5",
    card: "#FFFDF8",
    input: "#F4EBE1",
    tint: "#F7E8DF",
    border: "rgba(239, 169, 139, 0.26)",
    text: "#333332",
    subtext: "#75635a",
    navBg: "rgba(250, 244, 229, 0.88)",
  },
  butter: {
    id: "butter",
    name: "Cream Sand",
    shortName: "Sand",
    primary: "#E8CE74",
    onPrimary: "#2d2817",
    accentText: "#876c19",
    bg: "#FAF4E5",
    card: "#FFFDF8",
    input: "#F4EFE0",
    tint: "#F6EED3",
    border: "rgba(232, 206, 116, 0.28)",
    text: "#333332",
    subtext: "#706954",
    navBg: "rgba(250, 244, 229, 0.88)",
  },
};

/* Dark mode: luminous twilight pastels modeled after ashkatts-portfolio.vercel.app (#8395CD dusk + #FAF4E5 cream ink + #e8dbba sand) */
export const DARK_PASTEL_THEMES: Record<string, PastelTheme> = {
  blush: {
    id: "blush",
    name: "Blush Pink",
    shortName: "Blush",
    primary: "#F2B6C0",
    onPrimary: "#2B1820",
    accentText: "#F7CED5",
    bg: "#6B4957",
    card: "#7A5565",
    input: "#583A47",
    tint: "#866070",
    border: "rgba(250, 244, 229, 0.12)",
    text: "#FAF4E5",
    subtext: "#EED6DB",
    navBg: "rgba(107, 73, 87, 0.86)",
  },
  matcha: {
    id: "matcha",
    name: "Sage Mint",
    shortName: "Mint",
    primary: "#8FE0BE",
    onPrimary: "#132920",
    accentText: "#A9E8CE",
    bg: "#3C6657",
    card: "#477564",
    input: "#305447",
    tint: "#538573",
    border: "rgba(250, 244, 229, 0.12)",
    text: "#FAF4E5",
    subtext: "#CBECE0",
    navBg: "rgba(60, 102, 87, 0.86)",
  },
  sky: {
    id: "sky",
    name: "Periwinkle",
    shortName: "Periwinkle",
    primary: "#C2CEF5",
    onPrimary: "#1B223D",
    accentText: "#E8DBBA",
    bg: "#526298",
    card: "#5F70A8",
    input: "#435182",
    tint: "#6D7FB8",
    border: "rgba(232, 219, 186, 0.16)",
    text: "#FAF4E5",
    subtext: "#E8DBBA",
    navBg: "rgba(82, 98, 152, 0.86)",
  },
  lavender: {
    id: "lavender",
    name: "Soft Lavender",
    shortName: "Lavender",
    primary: "#CBC0F5",
    onPrimary: "#1F1836",
    accentText: "#E6DFFC",
    bg: "#594E7F",
    card: "#675B90",
    input: "#493F6B",
    tint: "#7568A1",
    border: "rgba(250, 244, 229, 0.12)",
    text: "#FAF4E5",
    subtext: "#DFD7FA",
    navBg: "rgba(89, 78, 127, 0.86)",
  },
  peach: {
    id: "peach",
    name: "Warm Peach",
    shortName: "Peach",
    primary: "#F5B89E",
    onPrimary: "#2E1915",
    accentText: "#FAD2C0",
    bg: "#764E50",
    card: "#855A5C",
    input: "#623F41",
    tint: "#936769",
    border: "rgba(250, 244, 229, 0.12)",
    text: "#FAF4E5",
    subtext: "#F5D9CE",
    navBg: "rgba(118, 78, 80, 0.86)",
  },
  butter: {
    id: "butter",
    name: "Cream Sand",
    shortName: "Sand",
    primary: "#F0DA86",
    onPrimary: "#262111",
    accentText: "#F5E7A8",
    bg: "#61563C",
    card: "#6F6346",
    input: "#4F4630",
    tint: "#7E7051",
    border: "rgba(250, 244, 229, 0.12)",
    text: "#FAF4E5",
    subtext: "#EAE0BA",
    navBg: "rgba(97, 86, 60, 0.86)",
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

  root.setAttribute("data-theme", theme.id);
  root.setAttribute("data-mode", activeMode);
  if (document.body) {
    document.body.setAttribute("data-theme", theme.id);
    document.body.setAttribute("data-mode", activeMode);
  }

  const props = {
    "--pastel-primary": theme.primary,
    "--pastel-on-primary": theme.onPrimary,
    "--pastel-accent-text": theme.accentText,
    "--pastel-bg": theme.bg,
    "--pastel-card": theme.card,
    "--pastel-input": theme.input,
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

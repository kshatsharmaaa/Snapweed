import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { PastelFallingLeaves } from "./components/PastelFallingLeaves";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Snapweed — Real-time Chat, Music & Notes",
  description: "Private real-time chat rooms, daily logs, shared tracks, and Q&A.",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("snapweed_theme")||"blush";var m=localStorage.getItem("snapweed_theme_mode")==="dark"?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme",t);r.setAttribute("data-mode",m);r.style.colorScheme=m;}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${montserrat.variable}`}
      data-theme="blush"
      data-mode="light"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans transition-colors duration-300">
        <PastelFallingLeaves />
        {children}
      </body>
    </html>
  );
}

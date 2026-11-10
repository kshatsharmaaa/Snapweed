import type { Metadata } from "next";
import "./globals.css";
import { PastelFallingLeaves } from "./components/PastelFallingLeaves";

export const metadata: Metadata = {
  title: "Snapweed — Real-time Chat & Cozy Community",
  description: "A gentle pastel space for real-time chats, favorite songs, questions, and personal logs.",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("snapweed_theme")||"blush";var m=localStorage.getItem("snapweed_theme_mode")==="dark"?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme",t);r.setAttribute("data-mode",m);r.style.colorScheme=m;}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" data-theme="blush" data-mode="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans transition-colors duration-200">
        <PastelFallingLeaves />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snapweed — Real-time Chat & Cozy Community",
  description: "A gentle pastel space for real-time chats, favorite songs, questions, and personal logs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" data-theme="blush" style={{ colorScheme: "light" }}>
      <body className="min-h-full flex flex-col font-sans transition-colors duration-200" style={{ colorScheme: "light" }}>
        {children}
      </body>
    </html>
  );
}

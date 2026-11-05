import type { Metadata } from "next";
import { Newsreader, Figtree } from "next/font/google";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const ui = Figtree({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quietpress — Your personal morning newspaper",
  description:
    "Interest-matched news. No ads. Email every morning. Print at your desk. Breaking alerts when it matters.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${ui.variable} font-ui antialiased`}>{children}</body>
    </html>
  );
}

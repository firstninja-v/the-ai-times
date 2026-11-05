import type { Metadata } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const ui = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The AI Times — Your personal morning newspaper",
  description:
    "Interest-matched news. No ads. Email every morning. Print at your desk. Breaking alerts when it matters.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${ui.variable} font-ui text-[15px] leading-relaxed`}>
        {children}
      </body>
    </html>
  );
}

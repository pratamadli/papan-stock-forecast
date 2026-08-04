import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { version } from "../package.json";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Papan | Forecast Saham",
  description:
    "Forecast saham IDX & US serta crypto — tren, momentum, dan sinyal buy/sell dalam satu papan.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="id"
      className={`dark ${fraunces.variable} ${plexMono.variable} ${inter.variable}`}
    >
      <body className="board-canvas min-h-screen font-body text-foreground antialiased">
        {children}
        <footer className="relative z-[1] border-t border-white/5 px-6 pb-8 pt-6 text-center sm:px-10">
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-muted-foreground">
            Papan v{version} · local-first desk
          </p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}

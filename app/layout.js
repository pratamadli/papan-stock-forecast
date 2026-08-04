import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
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
    <html lang="id" className={`${fraunces.variable} ${plexMono.variable} ${inter.variable}`}>
      <body className="board-canvas text-board-ink font-body antialiased">
        {children}
        <footer className="relative z-[1] px-6 pb-8 pt-4 text-center sm:px-10">
          <p className="font-mono text-[10px] uppercase tracking-widest2 text-board-dim">
            Papan v{version}
          </p>
        </footer>
      </body>
    </html>
  );
}

import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
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
    "Forecast harga saham IDX & US pribadi — tren, momentum, dan sinyal buy/sell dalam satu papan.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={`${fraunces.variable} ${plexMono.variable} ${inter.variable}`}>
      <body className="bg-board-bg text-board-ink font-body antialiased">
        {children}
      </body>
    </html>
  );
}

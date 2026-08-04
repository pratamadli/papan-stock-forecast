"use client";

import {
  Shield,
  Lock,
  EyeOff,
  Wallet,
  HardDrive,
  Activity,
  BadgeCheck,
  Globe2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/** Decorative sparkline — UI preview only, not live market data. */
function ChartPreview() {
  const path =
    "M0,62 C40,58 55,40 90,44 C130,48 150,22 190,28 C230,34 250,18 290,24 C320,28 340,12 360,16";
  const area =
    "M0,80 L0,62 C40,58 55,40 90,44 C130,48 150,22 190,28 C230,34 250,18 290,24 C320,28 340,12 360,16 L360,80 Z";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardDescription className="flex items-center gap-2">
              <Activity className="size-3.5 text-emerald-400" />
              Chart preview
            </CardDescription>
            <CardTitle className="mt-1 font-mono text-lg tracking-tight sm:text-xl">
              BTC · realtime style
            </CardTitle>
          </div>
          <Badge variant="success">+2.4%</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-36 overflow-hidden rounded-lg border border-white/5 bg-black/25">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.12),_transparent_55%)]" />
          <svg
            viewBox="0 0 360 80"
            className="absolute inset-x-2 bottom-2 h-[85%] w-[calc(100%-1rem)]"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="papan-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(45,212,191)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="rgb(45,212,191)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#papan-area)" />
            <path
              d={path}
              fill="none"
              stroke="rgb(45,212,191)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="absolute left-3 top-3 flex gap-2">
            <span className="rounded-md bg-black/40 px-2 py-0.5 font-mono text-[10px] text-emerald-300/90 backdrop-blur">
              SMA20
            </span>
            <span className="rounded-md bg-black/40 px-2 py-0.5 font-mono text-[10px] text-sky-300/80 backdrop-blur">
              Forecast
            </span>
          </div>
        </div>
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
          Ilustrasi UI — chart live muncul setelah Anda jalankan forecast ticker.
        </p>
      </CardContent>
    </Card>
  );
}

const SECURITY = [
  {
    icon: Lock,
    title: "Tanpa API key pasar",
    body: "Data Yahoo lewat server route — kunci rahasia tidak disimpan di browser.",
  },
  {
    icon: EyeOff,
    title: "Privasi lokal",
    body: "Watchlist & jurnal posisi hanya di perangkat Anda (localStorage).",
  },
  {
    icon: Shield,
    title: "Tanpa akun pihak ketiga",
    body: "Tidak perlu login exchange — forecast personal, kontrol penuh di sisi client.",
  },
];

const WALLET = [
  {
    icon: Wallet,
    title: "Personal vault",
    body: "Jurnal beli/jual tersimpan lokal — seperti dompet catatan pribadi, bukan on-chain wallet.",
  },
  {
    icon: HardDrive,
    title: "Device-bound",
    body: "Data tidak ikut sync ke cloud Papan. Backup via ekspor CSV kapan saja.",
  },
  {
    icon: Zap,
    title: "Siap multi-pasar",
    body: "IDX · US · CRYPTO dalam satu alur — USD/IDR tampilan konversi untuk aset dolar.",
  },
];

const TRUST = [
  { icon: BadgeCheck, label: "Open stack", value: "Next.js · Vercel" },
  { icon: Globe2, label: "Markets", value: "IDX · US · Crypto" },
  { icon: Shield, label: "Data path", value: "Server-side fetch" },
  { icon: Activity, label: "Signals", value: "Teknikal + hit-rate" },
];

export default function LandingShowcase() {
  return (
    <div className="mt-12 space-y-12 animate-fade-up">
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartPreview />
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              Trust
            </Badge>
            <CardTitle className="mt-2 text-lg">Indikator kepercayaan</CardTitle>
            <CardDescription>
              Fokus keamanan & transparansi — bukan janji return.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {TRUST.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-teal-400/10 text-teal-300">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest2 text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-sm text-foreground">{value}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest2 text-teal-300/80">
              Security
            </p>
            <h2 className="mt-1 font-display text-2xl text-foreground">
              Dibangun untuk rasa aman
            </h2>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {SECURITY.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="transition hover:border-teal-400/25">
              <CardHeader className="pb-2">
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-teal-400/10 text-teal-300">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">Vault</Badge>
              <Badge variant="outline">Local-first</Badge>
            </div>
            <CardTitle className="mt-2">Wallet & vault showcase</CardTitle>
            <CardDescription>
              Integrasi “dompet” di Papan = jurnal posisi di perangkat Anda — UI modern,
              fungsi tetap lokal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {WALLET.map(({ icon: Icon, title, body }, i) => (
                <div key={title} className="relative">
                  {i > 0 && (
                    <Separator className="absolute -left-2 top-0 hidden h-full md:block" orientation="vertical" />
                  )}
                  <div className="rounded-lg border border-white/5 bg-gradient-to-b from-white/[0.06] to-transparent p-4">
                    <Icon className="mb-3 size-5 text-amber-300/90" />
                    <p className="font-display text-base text-foreground">{title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

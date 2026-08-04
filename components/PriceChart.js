"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const WIDTH = 720;
const HEIGHT = 320;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

const COLORS = {
  close: "#E8E6DC",
  sma20: "#D4A94A",
  sma50: "#8B96AE",
  forecast: "#4FAE7A",
  divider: "#D4A94A",
};

const LEGEND_ITEMS = [
  { key: "close", label: "Harga close", color: COLORS.close, dashed: false },
  { key: "sma20", label: "SMA20", color: COLORS.sma20, dashed: false },
  { key: "sma50", label: "SMA50", color: COLORS.sma50, dashed: false },
  { key: "forecast", label: "Proyeksi ~10h", color: COLORS.forecast, dashed: true },
];

function buildPath(values, xScale, yScale) {
  let d = "";
  values.forEach((v, i) => {
    if (v == null) return;
    const x = xScale(i);
    const y = yScale(v);
    d += d === "" ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });
  return d;
}

function fmtPrice(n, currency) {
  if (n == null || Number.isNaN(n)) return "—";
  return currency === "IDR"
    ? `Rp ${n.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`
    : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtAxis(n, currency) {
  if (n == null || Number.isNaN(n)) return "—";
  return currency === "IDR"
    ? n.toLocaleString("id-ID", { maximumFractionDigits: 0 })
    : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function ChartLegend() {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-board-dim">
      {LEGEND_ITEMS.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden="true" className="shrink-0">
            <line
              x1="0"
              y1="4"
              x2="18"
              y2="4"
              stroke={item.color}
              strokeWidth="2"
              strokeDasharray={item.dashed ? "4 3" : undefined}
            />
          </svg>
          <span>{item.label}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <svg width="18" height="8" aria-hidden="true" className="shrink-0">
          <line
            x1="9"
            y1="0"
            x2="9"
            y2="8"
            stroke={COLORS.divider}
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.8"
          />
        </svg>
        <span>Hari ini</span>
      </span>
    </div>
  );
}

export default function PriceChart({ dates, closes, sma20, sma50, forecast, currency }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);

  const forecastCount = forecast?.length || 0;
  const totalPoints = closes?.length ? closes.length + forecastCount : 0;

  const scales = useMemo(() => {
    if (!closes || closes.length === 0) return null;

    const allValues = [
      ...closes,
      ...(sma20 || []).filter((v) => v != null),
      ...(sma50 || []).filter((v) => v != null),
      ...(forecast || []),
    ];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;

    const xScale = (i) => PAD.left + (i / Math.max(totalPoints - 1, 1)) * innerW;
    const yScale = (v) => PAD.top + innerH - ((v - min) / range) * innerH;

    return { min, max, range, innerW, innerH, xScale, yScale };
  }, [closes, sma20, sma50, forecast, totalPoints]);

  const resolveIndex = useCallback(
    (clientX) => {
      const svg = svgRef.current;
      if (!svg || !scales || totalPoints < 1) return null;
      const rect = svg.getBoundingClientRect();
      const xInSvg = ((clientX - rect.left) / rect.width) * WIDTH;
      const raw = ((xInSvg - PAD.left) / scales.innerW) * (totalPoints - 1);
      const idx = Math.round(raw);
      if (idx < 0 || idx >= totalPoints) return null;
      return idx;
    },
    [scales, totalPoints]
  );

  const buildHover = useCallback(
    (idx) => {
      if (idx == null || !closes) return null;
      const inForecast = idx >= closes.length;
      let dateLabel;
      let closeVal = null;
      let sma20Val = null;
      let sma50Val = null;
      let forecastVal = null;

      if (!inForecast) {
        dateLabel = dates[idx] || `t-${closes.length - 1 - idx}`;
        closeVal = closes[idx];
        sma20Val = sma20?.[idx] ?? null;
        sma50Val = sma50?.[idx] ?? null;
      } else {
        const fIdx = idx - closes.length; // 0 = first forecast day
        dateLabel = `+${fIdx + 1}h proyeksi`;
        forecastVal = forecast?.[fIdx] ?? null;
        closeVal = null;
      }

      return {
        idx,
        x: scales.xScale(idx),
        dateLabel,
        closeVal,
        sma20Val,
        sma50Val,
        forecastVal,
        inForecast,
      };
    },
    [closes, dates, sma20, sma50, forecast, scales]
  );

  const onPointerMove = useCallback(
    (e) => {
      const clientX = e.touches?.[0]?.clientX ?? e.clientX;
      if (clientX == null) return;
      const idx = resolveIndex(clientX);
      setHover(buildHover(idx));
    },
    [resolveIndex, buildHover]
  );

  const onPointerLeave = useCallback(() => setHover(null), []);

  if (!closes || closes.length === 0 || !scales) return null;

  const { min, range, xScale, yScale } = scales;
  const closePath = buildPath(closes, xScale, yScale);
  const sma20Path = sma20 ? buildPath(sma20, xScale, yScale) : "";
  const sma50Path = sma50 ? buildPath(sma50, xScale, yScale) : "";
  const forecastValues = forecast ? [closes[closes.length - 1], ...forecast] : [];
  const forecastPath = forecast
    ? buildPath(forecastValues, (i) => xScale(closes.length - 1 + i), yScale)
    : "";

  const gridLines = 4;
  const ticks = Array.from({ length: gridLines + 1 }, (_, i) => min + (range * i) / gridLines);

  // Keep tooltip inside plot horizontally
  const tipWidth = 168;
  const tipLeft =
    hover == null
      ? 0
      : Math.min(
          Math.max(PAD.left, hover.x - tipWidth / 2),
          WIDTH - PAD.right - tipWidth
        );

  return (
    <div>
      <ChartLegend />
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full h-auto touch-none"
          role="img"
          aria-label="Grafik harga dengan proyeksi tren. Gerakkan kursor untuk melihat nilai per tanggal."
          onMouseMove={onPointerMove}
          onMouseLeave={onPointerLeave}
          onTouchStart={onPointerMove}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerLeave}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yScale(t)}
                y2={yScale(t)}
                stroke="#243252"
                strokeWidth="1"
              />
              <text
                x={4}
                y={yScale(t) + 4}
                fill="#8B96AE"
                fontSize="10"
                fontFamily="var(--font-plex-mono)"
              >
                {fmtAxis(t, currency)}
              </text>
            </g>
          ))}

          <line
            x1={xScale(closes.length - 1)}
            x2={xScale(closes.length - 1)}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
            stroke={COLORS.divider}
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.5"
          />

          {sma50Path && (
            <path d={sma50Path} fill="none" stroke={COLORS.sma50} strokeWidth="1.25" opacity="0.7" />
          )}
          {sma20Path && (
            <path d={sma20Path} fill="none" stroke={COLORS.sma20} strokeWidth="1.25" opacity="0.85" />
          )}
          <path d={closePath} fill="none" stroke={COLORS.close} strokeWidth="2" />
          {forecastPath && (
            <path
              d={forecastPath}
              fill="none"
              stroke={COLORS.forecast}
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          )}

          {hover && (
            <g pointerEvents="none">
              <line
                x1={hover.x}
                x2={hover.x}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="#E8E6DC"
                strokeWidth="1"
                opacity="0.45"
              />
              {[
                { v: hover.closeVal, c: COLORS.close },
                { v: hover.sma20Val, c: COLORS.sma20 },
                { v: hover.sma50Val, c: COLORS.sma50 },
                { v: hover.forecastVal, c: COLORS.forecast },
              ]
                .filter((p) => p.v != null)
                .map((p, i) => (
                  <circle key={i} cx={hover.x} cy={yScale(p.v)} r="3.5" fill={p.c} stroke="#0B1220" strokeWidth="1" />
                ))}
            </g>
          )}

          {/* Invisible hit area for easier pointer capture */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={WIDTH - PAD.left - PAD.right}
            height={HEIGHT - PAD.top - PAD.bottom}
            fill="transparent"
          />

          <text x={PAD.left} y={HEIGHT - 6} fill="#8B96AE" fontSize="10" fontFamily="var(--font-plex-mono)">
            {dates[0]}
          </text>
          <text
            x={xScale(closes.length - 1) - 4}
            y={HEIGHT - 6}
            fill={COLORS.divider}
            fontSize="10"
            fontFamily="var(--font-plex-mono)"
            textAnchor="end"
          >
            hari ini
          </text>
          <text
            x={WIDTH - PAD.right}
            y={HEIGHT - 6}
            fill={COLORS.forecast}
            fontSize="10"
            fontFamily="var(--font-plex-mono)"
            textAnchor="end"
          >
            +{forecastCount}h
          </text>
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-sm border border-board-line bg-board-panel2 px-2.5 py-2 font-mono text-[10px] shadow-lg"
            style={{
              left: `${(tipLeft / WIDTH) * 100}%`,
              top: 8,
              width: `${(tipWidth / WIDTH) * 100}%`,
            }}
          >
            <div className="mb-1 text-board-gold">{hover.dateLabel}</div>
            {hover.inForecast ? (
              <div className="flex justify-between gap-2 text-board-ink">
                <span style={{ color: COLORS.forecast }}>Proyeksi</span>
                <span>{fmtPrice(hover.forecastVal, currency)}</span>
              </div>
            ) : (
              <>
                <Row color={COLORS.close} label="Close" value={fmtPrice(hover.closeVal, currency)} />
                <Row color={COLORS.sma20} label="SMA20" value={fmtPrice(hover.sma20Val, currency)} />
                <Row color={COLORS.sma50} label="SMA50" value={fmtPrice(hover.sma50Val, currency)} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ color, label, value }) {
  return (
    <div className="flex justify-between gap-2 text-board-ink">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

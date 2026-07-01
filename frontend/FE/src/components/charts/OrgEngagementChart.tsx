"use client";

import { useState, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  color?: string;
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1.5px solid var(--border)",
        borderRadius: 10,
        padding: "8px 12px",
        boxShadow: "0 2px 8px rgba(92,107,115,0.10)",
        fontSize: 12,
        color: "var(--ink)",
        minWidth: 140,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2, color: "var(--ink-ghost)" }}>
        Day {label}
      </div>
      <div style={{ color: "#B8832A", fontWeight: 700, fontSize: 14 }}>
        {payload[0].value} active member{payload[0].value !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ── Trend Badge ───────────────────────────────────────────────────────────────

function TrendBadge({ data }: { data: DataPoint[] }) {
  const trend = useMemo(() => {
    if (data.length < 8) return null;
    const half = Math.floor(data.length / 2);
    const first = data.slice(0, half);
    const last = data.slice(-half);
    const avgFirst = first.reduce((s, d) => s + d.value, 0) / first.length;
    const avgLast = last.reduce((s, d) => s + d.value, 0) / last.length;
    // Hide badge if first half is all zeros — percentage is meaningless
    if (avgFirst === 0) return null;
    // Hide if fewer than 4 non-zero points total
    const nonZero = data.filter((d) => d.value > 0).length;
    if (nonZero < 4) return null;
    const pct = Math.round(((avgLast - avgFirst) / avgFirst) * 100);
    return pct;
  }, [data]);

  if (trend === null) return null;

  const up = trend >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        background: up ? "#D4EDD7" : "#FAE0DC",
        color: up ? "#4E8C58" : "#C0392B",
        borderRadius: 20,
        padding: "2px 9px",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {up ? "↑" : "↓"} {Math.abs(trend)}% vs prev period
    </span>
  );
}

// ── Range toggles ─────────────────────────────────────────────────────────────

const RANGES = [
  { label: "7D", days: 7 },
  { label: "15D", days: 15 },
  { label: "30D", days: 30 },
] as const;

type Range = (typeof RANGES)[number]["days"];

// ── Main Component ────────────────────────────────────────────────────────────

export function OrgEngagementChart({ data, color = "#B8832A" }: Props) {
  const [range, setRange] = useState<Range>(15);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Slice to selected range (take last N points)
  const sliced = useMemo(() => {
    if (!data.length) return [];
    return data.slice(-range);
  }, [data, range]);

  const selectedPoint = selectedIdx !== null ? sliced[selectedIdx] ?? null : null;

  // Estimate mood check-ins as ~65% of active members
  const estimatedCheckIns = selectedPoint
    ? Math.round(selectedPoint.value * 0.65)
    : null;

  // Y-axis max: round up to nearest 5 for clean ticks
  const maxVal = useMemo(() => {
    const m = Math.max(...sliced.map((d) => d.value), 1);
    return Math.ceil(m / 5) * 5;
  }, [sliced]);

  // X-axis: show every other label to avoid crowding
  const xTickFormatter = (_: string, index: number) =>
    index % 2 === 0 ? sliced[index]?.label ?? "" : "";

  return (
    <div>
      {/* Header row: trend badge + range toggles */}
      <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
        <TrendBadge data={sliced} />
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => {
                setRange(r.days);
                setSelectedIdx(null);
              }}
              style={{
                padding: "3px 10px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                border: "1.5px solid",
                cursor: "pointer",
                transition: "all 0.15s",
                borderColor: range === r.days ? color : "rgba(60,50,40,0.15)",
                background: range === r.days ? color : "transparent",
                color: range === r.days ? "#fff" : "var(--ink-ghost)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Y-axis label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--ink-ghost)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 2,
          paddingLeft: 36,
        }}
      >
        Active Members
      </div>

      {/* Chart */}
      <div style={{ height: 180, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sliced}
            margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
            barCategoryGap="30%"
            onClick={(e) => {
              if (e?.activeTooltipIndex !== undefined) {
                setSelectedIdx((prev) =>
                  prev === e.activeTooltipIndex ? null : e.activeTooltipIndex!
                );
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid
              vertical={false}
              stroke="rgba(60,50,40,0.12)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              tickFormatter={xTickFormatter}
              tick={{ fontSize: 11, fill: "#8D99AE", fontWeight: 600 }}
              axisLine={{ stroke: "#D2DBE3" }}
              tickLine={false}
              interval={0}
            />
            <YAxis
              domain={[0, maxVal]}
              tickCount={5}
              tick={{ fontSize: 11, fill: "#8D99AE", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "rgba(60,50,40,0.05)" }}
              content={<CustomTooltip />}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {sliced.map((_, i) => (
                <Cell
                  key={i}
                  fill={color}
                  opacity={
                    selectedIdx === null
                      ? 0.85
                      : i === selectedIdx
                      ? 1
                      : 0.3
                  }
                  stroke={i === selectedIdx ? color : "none"}
                  strokeWidth={i === selectedIdx ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* X-axis caption */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--ink-ghost)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          textAlign: "center",
          marginTop: 2,
        }}
      >
        Day
      </div>

      {/* Selected day summary card */}
      {selectedPoint && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            borderRadius: 10,
            background: "var(--bg-surface-2)",
            border: "1.5px solid var(--border)",
            fontSize: 12,
            color: "var(--ink)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 700 }}>Day {selectedPoint.label}</span>
          <span
            style={{
              width: 1,
              height: 14,
              background: "rgba(60,50,40,0.15)",
              display: "inline-block",
            }}
          />
          <span>
            <span style={{ color: color, fontWeight: 700 }}>
              {selectedPoint.value}
            </span>{" "}
            active member{selectedPoint.value !== 1 ? "s" : ""}
          </span>
          {estimatedCheckIns !== null && (
            <>
              <span
                style={{
                  width: 1,
                  height: 14,
                  background: "rgba(60,50,40,0.15)",
                  display: "inline-block",
                }}
              />
              <span>
                <span style={{ color: "#4E8C58", fontWeight: 700 }}>
                  ~{estimatedCheckIns}
                </span>{" "}
                mood check-ins
              </span>
            </>
          )}
          <button
            onClick={() => setSelectedIdx(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-ghost)",
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

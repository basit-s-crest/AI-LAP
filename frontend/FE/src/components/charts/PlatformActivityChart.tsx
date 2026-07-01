"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function PlatformActivityChart({
  data,
  color = "#4E8C58",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const maxVal = useMemo(() => {
    const m = Math.max(...data.map((d) => d.value), 1);
    return Math.ceil(m / 5) * 5;
  }, [data]);

  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid
            vertical={false}
            stroke="rgba(60,50,40,0.07)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#8D99AE", fontWeight: 600 }}
            axisLine={{ stroke: "#D2DBE3" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, maxVal]}
            tickCount={5}
            tick={{ fontSize: 10, fill: "#8D99AE", fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(60,50,40,0.06)" }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid rgba(60,50,40,0.1)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

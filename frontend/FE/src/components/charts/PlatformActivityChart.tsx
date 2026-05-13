"use client";

import {
  Bar,
  BarChart,
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
  return (
    <div className="h-[110px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" hide />
          <YAxis hide />
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

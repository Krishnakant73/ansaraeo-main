"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type VoiceData = { name: string; value: number; isYou: boolean };

export default function ShareOfVoiceChart({ data }: { data: VoiceData[] }) {
  if (data.length === 0) {
    return <p className="p-6 text-center text-sm text-muted">Not enough run data yet to compute Share of Voice.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid horizontal={false} stroke="#ECECEC" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => [`${value ?? ""}%`, "Mentioned in"]} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.isYou ? "#D66A38" : "#D1D5DB"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

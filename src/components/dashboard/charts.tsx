"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const ACCENT = "#D66A38";
const GRID = "#F3F3F3";
const MUTED = "#6B7280";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #ECECEC",
  fontSize: 12,
  boxShadow: "0 10px 40px rgba(0,0,0,.06)",
  padding: "6px 10px",
} as const;

export type TrendPoint = { date: string; score: number };

export function VisibilityArea({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="flex h-[200px] items-center justify-center text-sm text-muted">
        Need a few days of runs before a trend line makes sense.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value) => [`${value ?? ""}%`, "Visibility"]}
          contentStyle={tooltipStyle}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke={ACCENT}
          strokeWidth={2.5}
          fill="url(#scoreFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export type EnginePoint = { name: string; rate: number; total: number };

export function EngineBar({ data }: { data: EnginePoint[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-[200px] items-center justify-center text-sm text-muted">
        No runs yet.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 38)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 28, top: 4, bottom: 4 }}
      >
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={84}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(214,106,56,0.06)" }}
          formatter={(value, _n, item) => [
            `${value}% · ${item.payload.total} runs`,
            "Mention rate",
          ]}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="rate" radius={[0, 8, 8, 0]} barSize={18} fill={ACCENT} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export type SentimentPoint = { name: string; value: number; color: string };

export function SentimentDonut({ data }: { data: SentimentPoint[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <p className="flex h-[200px] items-center justify-center text-sm text-muted">
        No sentiment data yet.
      </p>
    );
  }
  return (
    <div className="flex items-center gap-5">
      <ResponsiveContainer width="50%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={48}
            outerRadius={80}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${value}`, String(name)]}
            contentStyle={tooltipStyle}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: d.color }}
            />
            <span className="text-ink">{d.name}</span>
            <span className="ml-auto font-semibold text-ink">
              {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- benchmark comparisons ----------

export type ComparisonPoint = { name: string; rate: number | null; total: number };

/** Horizontal bar of a dimension's values (regions / languages / engines / industries). */
export function ComparisonBar({
  data,
  label = "Rate",
}: {
  data: ComparisonPoint[];
  label?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <p className="flex h-[160px] items-center justify-center text-sm text-muted">
        Not enough brands benchmarked here yet.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={104}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(214,106,56,0.06)" }}
          formatter={(value, _n, item) => [
            `${value}% · ${item.payload.total} brands`,
            label,
          ]}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="rate" radius={[0, 8, 8, 0]} barSize={18} fill={ACCENT} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export type BenchmarkSeries = { month: string; industry: number | null; you: number | null };

/** Two-series line: the industry benchmark vs the brand's own metric over time. */
export function BenchmarkComparisonLine({ data }: { data: BenchmarkSeries[] }) {
  if (data.length < 2) {
    return (
      <p className="flex h-[220px] items-center justify-center text-sm text-muted">
        Need a few months of benchmark data before a trend line makes sense.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: MUTED }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="industry"
          name="Industry avg"
          stroke={ACCENT}
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="you"
          name="Your brand"
          stroke="#1F2937"
          strokeWidth={2.5}
          strokeDasharray="5 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

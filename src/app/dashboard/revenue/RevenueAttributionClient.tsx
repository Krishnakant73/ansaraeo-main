"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DailyData = { date: string; aiSessions: number; orders: number; revenue: number };

function inr(n: number) {
  return "\u20b9" + Math.round(n).toLocaleString("en-IN");
}

export default function RevenueAttributionClient({ brandId }: { brandId: string }) {
  const [data, setData] = useState<DailyData[] | null>(null);
  const [totals, setTotals] = useState<{ aiSessions: number; orders: number; revenue: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analytics/revenue?brandId=${brandId}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        setLoading(false);
        if (!ok) {
          setError(data.error);
          return;
        }
        setData(data.daily);
        setTotals(data.totals);
      });
  }, [brandId]);

  if (loading) return <p className="text-sm text-muted">Loading revenue data…</p>;
  if (error) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-muted">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-6">
          <p className="text-xs font-medium text-muted">AI-Referred Sessions</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{totals?.aiSessions ?? 0}</p>
        </div>
        <div className="card p-6">
          <p className="text-xs font-medium text-muted">Orders</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{totals?.orders ?? 0}</p>
        </div>
        <div className="card p-6">
          <p className="text-xs font-medium text-muted">Revenue</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{inr(totals?.revenue ?? 0)}</p>
        </div>
      </div>

      <div className="card mt-6 p-6">
        <p className="text-xs font-medium text-muted">AI Sessions vs Revenue (last 30 days)</p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data ?? []} margin={{ top: 20, right: 10, left: -20 }}>
            <defs>
              <linearGradient id="sessionsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D66A38" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#D66A38" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#F3F3F3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="aiSessions" name="AI Sessions" stroke="#D66A38" strokeWidth={2} fill="url(#sessionsFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

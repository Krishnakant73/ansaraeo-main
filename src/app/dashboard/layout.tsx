import type { ReactNode } from "react";
import Link from "next/link";
import { BarChart3, Bot, FileSearch, Home, MessageSquare, Settings, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const NAV = [
  { icon: Home, label: "Dashboard", href: "/dashboard" },
  { icon: MessageSquare, label: "Prompts", href: "/dashboard/prompts" },
  { icon: FileSearch, label: "Citations", href: "/dashboard/citations" },
  { icon: ShieldCheck, label: "Site Audit", href: "/dashboard/site-audit" },
  { icon: Bot, label: "Agent", href: "/dashboard/agent" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings/billing" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-surface">
      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-line bg-white p-4 md:block">
          <Link href="/" className="flex items-center gap-2 px-2 text-lg font-bold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-xs font-extrabold text-white">
              A
            </span>
            AnsarAEO
          </Link>
          <nav className="mt-8 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}

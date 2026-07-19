"use client";

import { useRouter } from "next/navigation";
import { LogOut, Plug, Settings, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function UserMenu({ email }: { email: string | null }) {
  const router = useRouter();
  const initial = (email?.[0] ?? "U").toUpperCase();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-bold text-white shadow-sm outline-none transition hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          aria-label="Account menu"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{email ?? "Account"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/dashboard/settings/integrations")}>
          <Plug />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/dashboard/settings/billing")}>
          <Settings className="mr-2 h-4 w-4" /> Billing & plan
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/dashboard/onboarding")}>
          <User className="mr-2 h-4 w-4" /> Brand setup
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-rose-600 focus:text-rose-600">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

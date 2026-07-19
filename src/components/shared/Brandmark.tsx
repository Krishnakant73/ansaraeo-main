import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brandmark({
  className,
  showText = true,
  size = 32,
  tone = "dark",
}: {
  className?: string;
  showText?: boolean;
  size?: number;
  tone?: "dark" | "light";
}) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="AnsarAEO"
        width={size}
        height={size}
        className="rounded-lg object-contain"
        style={{ width: size, height: size }}
      />
      {showText && (
        <span
          className={cn(
            "text-lg font-extrabold tracking-tight",
            tone === "light" ? "text-white" : "text-ink",
          )}
        >
          AnsarAEO
        </span>
      )}
    </Link>
  );
}

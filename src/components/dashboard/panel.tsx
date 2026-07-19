import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const hasHeader = title || action;
  return (
    <section className={cn("panel", className)}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            {title && <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
